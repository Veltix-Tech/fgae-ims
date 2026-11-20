import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { en } from '../src/i18n/locales/en/auth'
import { am } from '../src/i18n/locales/am/auth'
import { participantKinds, participantRoles } from '../src/services/contracts/participant-overview'
const labels = { 'field-supervisor': { title: 'supervisorTitle', link: 'supervisorLink', values: ['0', '0', '1'] }, 'finance-officer': { title: 'financeTitle', link: 'financeLink', values: ['1', '1', '2'] }, volunteer: { title: 'volunteerTitle', link: 'volunteerLink', values: ['1', '1', '0'] } } as const
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
for (const kind of participantKinds) {
  const email = `${kind.replaceAll('-', '.')}@example.test`
  for (const locale of ['en', 'am'] as const) {
    const copy = locale === 'en' ? en : am
    for (const width of [360, 390, 768, 1024, 1440]) test(`${kind} ${locale} ${width}px scope, accessibility and navigation`, async ({ page }) => {
      await page.addInitScript(locale => localStorage.setItem('fgae.locale', locale), locale); await page.setViewportSize({ width, height: 900 })
      await login(page, email, copy); await page.getByRole('link', { name: copy[labels[kind].link], exact: true }).click()
      await expect(page).toHaveTitle(copy[labels[kind].title]); await expect(page.locator('.workspace-value')).toHaveCount(4)
      for (let i = 0; i < 3; i++) await expect(page.locator('.workspace-value').nth(i)).toHaveText(labels[kind].values[i]!)
      await expect(page.locator('.participant-assignments > li')).toHaveCount(kind === 'finance-officer' ? 0 : kind === 'field-supervisor' ? 1 : 2)
      await expect(page.locator('.participant-attendance > li')).toHaveCount(kind === 'finance-officer' ? 0 : kind === 'field-supervisor' ? 1 : 2)
      await expect(page.locator('.participant-allowances > li')).toHaveCount(6)
      await expect(page.locator('.participant-payments > li')).toHaveCount(kind === 'field-supervisor' ? 0 : 4)
      if (kind === 'field-supervisor') await expect(page.locator('.participant-allowances')).not.toContainText('ETB')
      else await expect(page.locator('.workspace-value').last()).toContainText(kind === 'finance-officer' ? '150' : '500')
      await expect(page.locator('main')).not.toContainText('Outside branch'); await axe(page)
      await page.screenshot({ path: `docs/screenshots/${kind}-${locale}-${width}.png`, fullPage: true, animations: 'disabled' })
      await page.getByRole('button', { name: copy.homeRefresh }).click(); await expect(page.locator('#participant-heading')).toBeFocused(); await expect(page.locator('.workspace-value')).toHaveCount(4)
      if (locale === 'am') expect(await page.locator('main').innerText()).not.toContain('።')
      if (kind === 'volunteer') { await page.getByRole('link', { name: copy.opsOwnApplication, exact: true }).click(); await expect(page).toHaveURL(/my-application$/); await page.goBack(); await expect(page.locator('.workspace-value')).toHaveCount(4) }
      await page.getByRole('link', { name: copy.homeOpenAccount }).click(); await expect(page.locator('#acct-name')).toBeVisible(); await page.goBack(); await expect(page.locator('.workspace-value')).toHaveCount(4)
      await page.getByRole('button', { name: copy.signOut, exact: true }).click(); await expect(page.getByRole('heading', { name: copy.mgrSignIn })).toBeVisible(); await expect(page.locator('.participant-allowances')).toHaveCount(0)
    })
    test(`${kind} live ${locale} empty, lifecycle, capability and scope`, async ({ page }) => {
      await page.addInitScript(locale => localStorage.setItem('fgae.locale', locale), locale)
      const identity = { id: 'operator', display_name: 'Operator', email, role_grants: [{ role: participantRoles[kind], scope: { kind: kind === 'field-supervisor' ? 'supervision' : kind === 'volunteer' ? 'self' : 'branch', id: kind === 'finance-officer' ? 'branch-a' : 'operator' } }, { role: 'HR', scope: { kind: 'global', id: '*' } }], account_status: 'ACTIVE', must_change_password: false }
      await page.route('**/auth/refresh', route => route.fulfill({ json: { success: true, data: { access_token: 'operator-token' } } }))
      await page.route('**/auth/me', route => route.fulfill({ json: { success: true, data: identity } }))
      let status = 503
      const empty = { ownerId: 'operator', kind, complete: true, generatedAt: '2026-11-18T12:00:00Z', capabilities: { approve: false, disburse: false }, assignments: [], attendance: [], allowances: [], payments: [], budgets: [] }
      let data: Record<string, unknown> = { ...empty }
      await page.route(`**/${kind}/overview`, route => { expect(route.request().headers().authorization).toBe('Bearer operator-token'); return route.fulfill({ status, json: { success: status === 200, data } }) })
      await page.goto(`http://127.0.0.1:5174/workspaces/${kind}`); await expect(page.getByRole('alert')).toContainText(copy.mgrUnavailable)
      status = 429; await page.getByRole('button', { name: copy.appRetry }).click(); await expect(page.getByRole('alert')).toContainText(copy.RATE_LIMITED)
      status = 200; await page.getByRole('button', { name: copy.appRetry }).click(); await expect(page.getByText(copy.opsNoAllowances, { exact: true })).toBeVisible(); await axe(page)
      const placement = { branchId: 'branch-a', areaId: 'area-a', projectId: 'project-a' }
      const allowance = { ...placement, id: 'request', title: 'Verified request', volunteerId: 'operator', supervisorId: 'operator', createdBy: 'another', approvedBy: null, amountMinor: kind === 'field-supervisor' ? null : 15000, state: 'VERIFIED', updatedAt: '2026-11-18T12:00:00Z' }
      data = { ...empty, capabilities: { approve: kind === 'finance-officer', disburse: false }, allowances: [allowance],
        assignments: kind === 'finance-officer' ? [] : [{ ...placement, id: 'assignment', title: 'Assigned outreach', place: 'Branch A', volunteerId: 'operator', volunteerName: 'Colleague', supervisorId: 'operator', state: 'ACTIVE', startAt: '2026-11-18T06:00:00Z', endAt: '2026-11-18T14:00:00Z' }],
        attendance: kind === 'finance-officer' ? [] : [{ id: 'attendance', assignmentId: 'assignment', date: '2026-11-18', attendance: 'EXCUSED', verification: 'REJECTED', evidence: false }],
      }
      await page.getByRole('button', { name: copy.homeRefresh }).click(); await expect(page.locator('.participant-allowances')).toContainText(copy.opsVerifiedRequest)
      if (kind === 'finance-officer') { await expect(page.locator('.workspace-value').first()).toHaveText('1'); await expect(page.getByText(copy.opsCanApprove, { exact: true })).toBeVisible(); await expect(page.getByText(copy.opsCanDisburse, { exact: true })).toHaveCount(0) }
      else { await expect(page.locator('.participant-attendance')).toContainText(copy.opsExcused); await expect(page.locator('.participant-attendance')).toContainText(copy.appRejected) }
      await axe(page)
      if (kind === 'finance-officer') {
        data = { ...data, allowances: [{ ...allowance, createdBy: 'operator' }] }; await page.getByRole('button', { name: copy.homeRefresh }).click(); await expect(page.locator('.workspace-value').first()).toHaveText('0')
        data = { ...data, capabilities: { approve: false, disburse: false } }; await page.getByRole('button', { name: copy.homeRefresh }).click(); await expect(page.getByText(copy.opsReadOnly, { exact: true })).toBeVisible()
      }
      data = { ...data, complete: false }; await page.getByRole('button', { name: copy.homeRefresh }).click(); await expect(page.getByRole('alert')).toContainText(copy.mgrUnavailable)
      data = { ...data, complete: true, ownerId: 'another' }; await page.getByRole('button', { name: copy.appRetry }).click(); await expect(page.getByRole('alert')).toContainText(copy.mgrUnavailable)
      data = { ...data, ownerId: 'operator', allowances: [{ ...allowance, title: 'Private allowance', branchId: 'outside', areaId: 'outside', projectId: 'outside', volunteerId: 'outside', supervisorId: 'outside' }] }; await page.getByRole('button', { name: copy.appRetry }).click(); await expect(page.getByRole('alert')).toContainText(copy.mgrUnavailable); await expect(page.locator('main')).not.toContainText('Private allowance')
      status = 403; await page.getByRole('button', { name: copy.appRetry }).click(); await expect(page.getByRole('heading', { name: copy.mgrDenied })).toBeVisible()
      expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('fgae.synthetic')))).toEqual([])
    })
  }
  test(`${kind} guards, offline, expiry, cross-tab and admin`, async ({ page, context }) => {
    await page.goto(`/workspaces/${kind}`); await expect(page.getByRole('heading', { name: en.mgrSignIn })).toBeVisible()
    await login(page, 'hr@example.test'); await expect(page.getByRole('link', { name: en[labels[kind].link] })).toHaveCount(0)
    await page.goto(`/workspaces/${kind}`); await expect(page.getByRole('heading', { name: en.mgrDenied })).toBeVisible()
    await page.emulateMedia({ reducedMotion: 'reduce' }); await login(page, email); await page.goto(`/workspaces/${kind}`); await expect(page.locator('.workspace-value')).toHaveCount(4)
    await context.setOffline(true); await page.getByRole('button', { name: en.homeRefresh }).click(); await expect(page.getByRole('alert')).toContainText(en.NETWORK); await expect(page.locator('.participant-allowances')).toHaveCount(0)
    await context.setOffline(false); await page.getByRole('button', { name: en.appRetry }).click(); await expect(page.locator('.workspace-value')).toHaveCount(4)
    await page.evaluate(() => { const key = 'fgae.synthetic.auth.v1'; sessionStorage.setItem(key, JSON.stringify({ ...JSON.parse(sessionStorage.getItem(key)!), expiresAt: 0 })) }); await page.getByRole('button', { name: en.homeRefresh }).click(); await expect(page.getByRole('heading', { name: en.mgrSignIn })).toBeVisible()
    await login(page, email); await page.goto(`/workspaces/${kind}`); await expect(page.locator('.workspace-value')).toHaveCount(4)
    await page.evaluate(() => { const bus = new BroadcastChannel('fgae.auth'); bus.postMessage('signed-out'); bus.close() }); await expect(page.getByRole('heading', { name: en.mgrSignIn })).toBeVisible()
    await login(page, 'super.admin@example.test'); await page.getByRole('link', { name: en[labels[kind].link] }).click(); await expect(page.locator('.workspace-value')).toHaveCount(4)
    if (kind === 'finance-officer') { await expect(page.locator('.workspace-value').first()).toHaveText('3'); await expect(page.getByText(en.opsAdmin)).toBeVisible() }
  })
}
