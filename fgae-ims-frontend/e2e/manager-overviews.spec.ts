import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { en } from '../src/i18n/locales/en/auth'
import { am } from '../src/i18n/locales/am/auth'
import { managerKinds, managerRoles } from '../src/services/contracts/manager-overview'
const labels = { 'area-manager': { title: 'areaTitle', link: 'areaLink', values: ['4', '1', '1', '1'] }, 'branch-manager': { title: 'branchTitle', link: 'branchLink', values: ['3', '1', '4', '1'] }, 'volunteer-manager': { title: 'vmTitle', link: 'vmLink', values: ['1', '1', '1', '1'] } } as const
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
for (const kind of managerKinds) {
  const email = `${kind.replaceAll('-', '.')}@example.test`
  for (const locale of ['en', 'am'] as const) {
    const copy = locale === 'en' ? en : am
    for (const width of [360, 390, 768, 1024, 1440]) test(`${kind} ${locale} ${width}px summaries, accessibility and navigation`, async ({ page }) => {
      await page.addInitScript(locale => localStorage.setItem('fgae.locale', locale), locale); await page.setViewportSize({ width, height: 900 })
      await login(page, email, copy); await page.getByRole('link', { name: copy[labels[kind].link], exact: true }).click()
      await expect(page).toHaveTitle(copy[labels[kind].title]); await expect(page.locator('.workspace-value')).toHaveText([...labels[kind].values])
      await expect(page.locator('.manager-work > li')).toHaveCount(kind === 'area-manager' ? 4 : 3)
      await expect(page.locator('.manager-volunteers li')).toHaveCount(1); await expect(page.locator('.manager-applications li')).toHaveCount(kind === 'volunteer-manager' ? 3 : 0)
      await expect(page.locator('main')).not.toContainText('Branch B'); await axe(page)
      await page.screenshot({ path: `docs/screenshots/${kind}-${locale}-${width}.png`, fullPage: true, animations: 'disabled' })
      await page.getByRole('button', { name: copy.homeRefresh }).click(); await expect(page.locator('#manager-heading')).toBeFocused(); await expect(page.locator('.workspace-value')).toHaveCount(4)
      if (locale === 'am') expect(await page.locator('main').innerText()).not.toContain('።')
      await page.getByRole('link', { name: copy.homeOpenAccount }).click(); await expect(page.locator('#acct-name')).toBeVisible(); await page.goBack(); await expect(page.locator('.workspace-value')).toHaveCount(4)
      await page.getByRole('button', { name: copy.signOut, exact: true }).click(); await expect(page.getByRole('heading', { name: copy.mgrSignIn })).toBeVisible(); await expect(page.locator('.manager-work')).toHaveCount(0)
    })
    test(`${kind} live ${locale} retry, empty, lifecycle and scope`, async ({ page }) => {
      await page.addInitScript(locale => localStorage.setItem('fgae.locale', locale), locale)
      const identity = { id: 'manager', display_name: 'Manager', email, role_grants: [{ role: managerRoles[kind], scope: { kind: kind === 'area-manager' ? 'area' : 'branch', id: kind === 'area-manager' ? 'area-a' : 'branch-a' } }, { role: 'HR', scope: { kind: 'global', id: '*' } }], account_status: 'ACTIVE', must_change_password: false }
      await page.route('**/auth/refresh', route => route.fulfill({ json: { success: true, data: { access_token: 'manager-token' } } }))
      await page.route('**/auth/me', route => route.fulfill({ json: { success: true, data: identity } }))
      const locations = [{ id: 'branch-a', areaId: 'area-a', name: 'Branch A', kind: 'branch' }, ...(kind === 'area-manager' ? [{ id: 'area-a', areaId: 'area-a', name: 'Area A', kind: 'area' }] : [])]
      let status = 503
      const zero = { work: 0, active: 0, allocation: 0, unfilled: 0, supervision: 0, attendance: 0, volunteers: 0, inactiveVolunteers: 0, pending: 0, returned: 0, applications: 0 }
      let data: Record<string, unknown> = { ownerId: 'manager', kind, generatedAt: '2026-11-17T12:00:00Z', locations, counts: zero, work: [], applications: [], volunteers: [] }
      await page.route(`**/${kind}/overview`, route => { expect(route.request().headers().authorization).toBe('Bearer manager-token'); return route.fulfill({ status, json: { success: status === 200, data } }) })
      await page.goto(`http://127.0.0.1:5174/workspaces/${kind}`); await expect(page.getByRole('alert')).toContainText(copy.mgrUnavailable)
      status = 429; await page.getByRole('button', { name: copy.appRetry }).click(); await expect(page.getByRole('alert')).toContainText(copy.RATE_LIMITED)
      status = 200; await page.getByRole('button', { name: copy.appRetry }).click(); await expect(page.getByRole('heading', { name: copy.mgrNoWork })).toBeVisible(); await axe(page)
      data = { ...data, counts: { ...zero, work: 1, inactiveVolunteers: 1, applications: kind === 'volunteer-manager' ? 1 : 0, returned: kind === 'volunteer-manager' ? 1 : 0 },
        work: [{ id: 'w', title: 'Cancelled work', locationId: kind === 'area-manager' ? 'area-a' : 'branch-a', state: 'CANCELLED', dueAt: '2026-11-18T10:00:00Z', target: 2, assigned: 0, attendancePending: 0, needsAllocation: false, needsSupervisor: false }],
        volunteers: [{ id: 'v', name: 'Inactive colleague', locationId: 'branch-a', state: 'INACTIVE', updatedAt: '2026-11-16T10:00:00Z' }],
        applications: kind === 'volunteer-manager' ? [{ id: 'a', name: 'Returned applicant', locationId: 'branch-a', state: 'RETURNED', updatedAt: '2026-11-16T10:00:00Z' }] : [],
      }
      await page.getByRole('button', { name: copy.homeRefresh }).click(); await expect(page.locator('.manager-work')).toContainText(copy.mgrCancelled); await expect(page.locator('.manager-volunteers')).toContainText(copy.mgrInactive); await axe(page)
      data = { ...data, ownerId: 'other' }; await page.getByRole('button', { name: copy.homeRefresh }).click(); await expect(page.getByRole('alert')).toContainText(copy.mgrUnavailable)
      data = { ...data, ownerId: 'manager', locations: [...locations, { id: 'private', areaId: 'area-b', name: 'Private branch', kind: 'branch' }] }; await page.getByRole('button', { name: copy.appRetry }).click(); await expect(page.getByRole('alert')).toContainText(copy.mgrUnavailable); await expect(page.locator('main')).not.toContainText('Private branch')
      status = 403; await page.getByRole('button', { name: copy.appRetry }).click(); await expect(page.getByRole('heading', { name: copy.mgrDenied })).toBeVisible()
      expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('fgae.synthetic')))).toEqual([])
    })
  }
  test(`${kind} guards, offline, expiry, cross-tab and global administration`, async ({ page, context }) => {
    await page.goto(`/workspaces/${kind}`); await expect(page.getByRole('heading', { name: en.mgrSignIn })).toBeVisible()
    await login(page, 'hr@example.test'); await expect(page.getByRole('link', { name: en[labels[kind].link] })).toHaveCount(0)
    await page.goto(`/workspaces/${kind}`); await expect(page.getByRole('heading', { name: en.mgrDenied })).toBeVisible()
    await page.emulateMedia({ reducedMotion: 'reduce' }); await login(page, email); await page.goto(`/workspaces/${kind}`); await expect(page.locator('.workspace-value')).toHaveCount(4)
    await context.setOffline(true); await page.getByRole('button', { name: en.homeRefresh }).click(); await expect(page.getByRole('alert')).toContainText(en.NETWORK); await expect(page.locator('.manager-work')).toHaveCount(0)
    await context.setOffline(false); await page.getByRole('button', { name: en.appRetry }).click(); await expect(page.locator('.workspace-value')).toHaveCount(4)
    await page.evaluate(() => { const key = 'fgae.synthetic.auth.v1'; sessionStorage.setItem(key, JSON.stringify({ ...JSON.parse(sessionStorage.getItem(key)!), expiresAt: 0 })) }); await page.getByRole('button', { name: en.homeRefresh }).click(); await expect(page.getByRole('heading', { name: en.mgrSignIn })).toBeVisible()
    await login(page, email); await page.goto(`/workspaces/${kind}`); await expect(page.locator('.workspace-value')).toHaveCount(4)
    await page.evaluate(() => { const bus = new BroadcastChannel('fgae.auth'); bus.postMessage('signed-out'); bus.close() }); await expect(page.getByRole('heading', { name: en.mgrSignIn })).toBeVisible()
    await login(page, 'super.admin@example.test'); await page.getByRole('link', { name: en[labels[kind].link] }).click(); await expect(page.locator('.manager-work')).toContainText('Branch B outreach')
  })
}
