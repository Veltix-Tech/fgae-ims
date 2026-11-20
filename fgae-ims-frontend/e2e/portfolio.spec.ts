import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { en } from '../src/i18n/locales/en/auth'
import { am } from '../src/i18n/locales/am/auth'
import { portfolioKinds, portfolioPath } from '../src/services/contracts/portfolio'
const labels = { 'project-manager': { title: 'projectTitle', link: 'projectLink', email: 'project.manager@example.test', values: ['1', '1', '1'] }, member: { title: 'memberTitle', link: 'memberLink', email: 'member@example.test', values: ['1', '1', '0'] }, users: { title: 'usersTitle', link: 'usersLink', email: 'super.admin@example.test', values: ['25', '21', '2'] } } as const
async function login(page: Page, email: string, copy: typeof am = en) {
  await page.goto('/sign-in'); await expect(page.locator('#email').or(page.getByRole('button', { name: copy.signOut, exact: true }))).toBeVisible()
  if (await page.getByRole('button', { name: copy.signOut, exact: true }).isVisible()) await page.getByRole('button', { name: copy.signOut, exact: true }).click()
  await page.locator('#email').fill(email); await page.locator('#password').fill('Demo-only-2026!'); await page.getByRole('button', { name: copy.signIn, exact: true }).click(); await expect(page.getByRole('heading', { name: copy.signedIn })).toBeVisible()
}
async function axe(page: Page) {
  await page.evaluate(async () => { await document.fonts.ready; document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).forEach(animation => animation.finish()) })
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}
for (const kind of portfolioKinds) {
  const path = portfolioPath(kind)
  for (const locale of ['en', 'am'] as const) {
    const copy = locale === 'en' ? en : am
    test(`${kind} ${locale} five widths, accessibility, navigation and interactions`, async ({ page }) => {
      await page.addInitScript(locale => localStorage.setItem('fgae.locale', locale), locale)
      await login(page, labels[kind].email, copy); await page.getByRole('link', { name: copy[labels[kind].link], exact: true }).click()
      await expect(page).toHaveTitle(copy[labels[kind].title]); await expect(page.locator('.workspace-value')).toHaveCount(4)
      for (let i = 0; i < 3; i++) await expect(page.locator('.workspace-value').nth(i)).toHaveText(labels[kind].values[i]!)
      if (kind === 'project-manager') { await expect(page.locator('.portfolio-project')).toHaveCount(1); await expect(page.locator('.portfolio-work > li')).toHaveCount(4); await expect(page.locator('main')).not.toContainText('Outside project') }
      if (kind === 'member') { await expect(page.locator('.portfolio-membership')).toHaveCount(1); await expect(page.locator('.portfolio-history > li')).toHaveCount(2); await expect(page.locator('.workspace-value').last()).toContainText('150') }
      for (const width of [360, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 }); await axe(page)
        await page.screenshot({ path: `docs/screenshots/${kind}-${locale}-${width}.png`, fullPage: true, animations: 'disabled' })
      }
      if (locale === 'am') expect(await page.locator('main').innerText()).not.toContain('።')
      if (kind === 'users') {
        await page.setViewportSize({ width: 390, height: 900 })
        await expect(page.locator('.directory-users > li')).toHaveCount(8); await expect(page.getByRole('button', { name: copy.portPrevious, exact: true })).toBeDisabled()
        await page.getByRole('button', { name: copy.portNext, exact: true }).click(); await expect(page.locator('#directory-heading')).toBeFocused(); await expect(page.locator('.directory-pages')).toContainText('2')
        await page.getByLabel(copy.portSearch).fill('volunteer@example.test'); await expect(page.locator('.directory-users > li')).toHaveCount(2); await page.getByLabel(copy.portRole, { exact: true }).selectOption('MEMBER'); await expect(page.locator('.directory-users > li')).toHaveCount(1); await expect(page.locator('.directory-grants')).toContainText(copy.VOLUNTEER); await expect(page.locator('.directory-grants')).toContainText(copy.MEMBER)
        await page.getByLabel(copy.portRole, { exact: true }).selectOption('HR'); await expect(page.getByText(copy.portNoResults)).toBeVisible(); await axe(page)
        await page.getByRole('button', { name: copy.portClear }).click(); await expect(page.locator('#directory-search')).toBeFocused()
        await page.getByLabel(copy.portState, { exact: true }).selectOption('SUSPENDED'); await expect(page.locator('.directory-users > li')).toHaveCount(1); await expect(page.locator('.directory-users')).toContainText(copy.accessSuspended)
        await page.getByRole('button', { name: copy.portClear }).click(); await page.getByLabel(copy.portSearch).fill('Demo branch A'); await page.getByLabel(copy.portRole, { exact: true }).selectOption('HR'); await expect(page.locator('.directory-users > li')).toHaveCount(2)
        await page.getByRole('button', { name: copy.homeRefresh }).click(); await expect(page.getByLabel(copy.portSearch)).toHaveValue('Demo branch A'); await expect(page.locator('.directory-users > li')).toHaveCount(2)
      } else { await page.getByRole('button', { name: copy.homeRefresh }).click(); await expect(page.locator('#portfolio-heading')).toBeFocused() }
      await page.getByRole('link', { name: copy.acctHeading, exact: true }).click(); await expect(page.locator('#acct-name')).toBeVisible(); await page.goBack(); await expect(page.locator('.workspace-value')).toHaveCount(4)
      await page.getByRole('button', { name: copy.signOut, exact: true }).click(); await expect(page.getByRole('heading', { name: copy.mgrSignIn })).toBeVisible(); await expect(page.locator('.workspace-value')).toHaveCount(0)
    })
    test(`${kind} live ${locale} empty, independent states, errors and scope`, async ({ page }) => {
      await page.addInitScript(locale => localStorage.setItem('fgae.locale', locale), locale)
      const grant = kind === 'project-manager' ? { role: 'PROJECT_MANAGER', scope: { kind: 'project', id: 'project-a' } } : kind === 'member' ? { role: 'MEMBER', scope: { kind: 'self', id: 'owner' } } : { role: 'SUPER_ADMIN', scope: { kind: 'global', id: '*' } }
      await page.route('**/auth/refresh', route => route.fulfill({ json: { success: true, data: { access_token: 'portfolio-token' } } }))
      await page.route('**/auth/me', route => route.fulfill({ json: { success: true, data: { id: 'owner', display_name: 'Current user', email: 'owner@example.test', role_grants: [grant, { role: 'HR', scope: { kind: 'global', id: '*' } }], account_status: 'ACTIVE', must_change_password: false } } }))
      const empty = { ownerId: 'owner', kind, complete: true, generatedAt: '2026-11-20T12:00:00Z', projects: [], memberships: [], users: [] }
      let status = 503; let data: Record<string, unknown> = { ...empty }
      await page.route(`**${path}/overview`, route => { expect(route.request().headers().authorization).toBe('Bearer portfolio-token'); return route.fulfill({ status, json: { success: status === 200, data } }) })
      await page.goto(`http://127.0.0.1:5174${path}`); await expect(page.getByRole('alert')).toContainText(copy.mgrUnavailable)
      status = 429; await page.getByRole('button', { name: copy.appRetry }).click(); await expect(page.getByRole('alert')).toContainText(copy.RATE_LIMITED)
      status = 200; await page.getByRole('button', { name: copy.appRetry }).click(); await expect(page.getByText(kind === 'users' ? copy.portNoUsers : kind === 'member' ? copy.portNoMemberships : copy.portNoProjects, { exact: true })).toBeVisible(); await axe(page)
      const project = { id: 'project-a', name: 'Scoped project', state: 'COMPLETED', startAt: '2026-11-01T00:00:00Z', endAt: '2026-12-31T00:00:00Z', availableMinor: 0, work: [{ id: 'work', title: 'Completed activity', state: 'COMPLETED', dueAt: '2026-11-19T12:00:00Z', volunteerIds: ['person'], attendance: [{ id: 'evidence', verification: 'REJECTED' }] }], allowances: [{ id: 'request', state: 'RETURNED', amountMinor: 10000, updatedAt: '2026-11-20T12:00:00Z' }] }
      const membership = { id: 'membership', ownerId: 'owner', name: 'Member', status: 'APPLIED', review: 'RETURNED', category: null, duesMinor: null, expiresAt: null, renewalEligible: false, history: [{ id: 'history', status: 'RETURNED', at: '2026-11-20T12:00:00Z', note: 'Confirm category' }], payments: [{ id: 'payment', state: 'SUCCESSFUL', amountMinor: 10000, at: '2026-11-19T12:00:00Z' }] }
      const user = { id: 'person', name: 'Suspended person', email: 'person@example.test', state: 'SUSPENDED', mustChangePassword: false, grants: [] }
      data = { ...empty, projects: kind === 'project-manager' ? [project] : [], memberships: kind === 'member' ? [membership] : [], users: kind === 'users' ? [user] : [] }
      await page.getByRole('button', { name: copy.homeRefresh }).click(); await expect(page.locator('.workspace-value')).toHaveCount(4)
      if (kind === 'member') { await expect(page.locator('.portfolio-membership')).toContainText(copy.portApplied); await expect(page.locator('.portfolio-membership')).toContainText(copy.appReturned); await expect(page.locator('.workspace-value').last()).toContainText('100'); await expect(page.getByText(copy.portUnconfigured, { exact: true })).toHaveCount(2) }
      if (kind === 'project-manager') { await expect(page.locator('.workspace-value').nth(1)).toHaveText('0'); await expect(page.locator('.portfolio-work')).toContainText(copy.mgrCompleted) }
      if (kind === 'users') await expect(page.locator('.directory-users')).toContainText(copy.accessSuspended)
      await axe(page)
      data = { ...data, complete: false }; await page.getByRole('button', { name: copy.homeRefresh }).click(); await expect(page.getByRole('alert')).toContainText(copy.mgrUnavailable)
      data = { ...data, complete: true, ownerId: 'other' }; await page.getByRole('button', { name: copy.appRetry }).click(); await expect(page.getByRole('alert')).toContainText(copy.mgrUnavailable)
      data = { ...data, ownerId: 'owner', ...(kind === 'project-manager' ? { projects: [{ ...project, id: 'outside', name: 'Private project' }] } : kind === 'member' ? { memberships: [{ ...membership, ownerId: 'outside', name: 'Private member' }] } : { users: [{ ...user, grants: [{ role: 'MEMBER', scope: { kind: 'self', id: 'other' }, scopeName: 'Private scope' }] }] }) }
      await page.getByRole('button', { name: copy.appRetry }).click(); await expect(page.getByRole('alert')).toContainText(copy.mgrUnavailable); await expect(page.locator('main')).not.toContainText('Private')
      status = 403; await page.getByRole('button', { name: copy.appRetry }).click(); await expect(page.getByRole('heading', { name: copy.mgrDenied })).toBeVisible()
      expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('fgae.synthetic')))).toEqual([])
    })
  }
  test(`${kind} direct guards, offline, expiry, cross-tab, multi-role and admin`, async ({ page, context }) => {
    await page.goto(path); await expect(page.getByRole('heading', { name: en.mgrSignIn })).toBeVisible()
    await login(page, 'hr@example.test'); await expect(page.getByRole('link', { name: en[labels[kind].link] })).toHaveCount(0); await page.goto(path); await expect(page.getByRole('heading', { name: en.mgrDenied })).toBeVisible()
    await page.emulateMedia({ reducedMotion: 'reduce' }); await login(page, labels[kind].email); await page.goto(path); await expect(page.locator('.workspace-value')).toHaveCount(4)
    await context.setOffline(true); await page.getByRole('button', { name: en.homeRefresh }).click(); await expect(page.getByRole('alert')).toContainText(en.NETWORK); await expect(page.locator('.workspace-value')).toHaveCount(0)
    await context.setOffline(false); await page.getByRole('button', { name: en.appRetry }).click(); await expect(page.locator('.workspace-value')).toHaveCount(4)
    await page.evaluate(() => { const key = 'fgae.synthetic.auth.v1'; sessionStorage.setItem(key, JSON.stringify({ ...JSON.parse(sessionStorage.getItem(key)!), expiresAt: 0 })) }); await page.getByRole('button', { name: en.homeRefresh }).click(); await expect(page.getByRole('heading', { name: en.mgrSignIn })).toBeVisible()
    await login(page, labels[kind].email); await page.goto(path); await expect(page.locator('.workspace-value')).toHaveCount(4)
    await page.evaluate(() => { const bus = new BroadcastChannel('fgae.auth'); bus.postMessage('signed-out'); bus.close() }); await expect(page.getByRole('heading', { name: en.mgrSignIn })).toBeVisible()
    if (kind === 'member') { await login(page, 'multi.role@example.test'); await expect(page.getByRole('link', { name: en.volunteerLink })).toBeVisible(); await page.getByRole('link', { name: en.memberLink }).click(); await expect(page.locator('.portfolio-membership')).toContainText(en.appReturned); await expect(page.locator('.portfolio-membership')).not.toContainText('Demo 10') }
    await login(page, 'super.admin@example.test'); await page.getByRole('link', { name: en[labels[kind].link] }).click(); await expect(page.locator('.workspace-value')).toHaveCount(4)
    if (kind === 'project-manager') await expect(page.locator('main')).toContainText('Outside project')
    if (kind === 'member') await expect(page.locator('.portfolio-membership')).toHaveCount(2)
    if (kind === 'users') { await page.getByRole('link', { name: en.homeLink }).click(); await page.getByRole('link', { name: en.usersHeading, exact: true }).click(); await expect(page).toHaveURL(/\/users$/) }
  })
}
