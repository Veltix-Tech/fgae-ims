import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { en } from '../src/i18n/locales/en/auth'
import { am } from '../src/i18n/locales/am/auth'
async function login(page: Page, copy: typeof am = en, email = 'hr@example.test') {
  await page.goto('/sign-in')
  await expect(page.locator('#email').or(page.getByRole('button', { name: copy.signOut, exact: true }))).toBeVisible()
  if (await page.getByRole('button', { name: copy.signOut, exact: true }).isVisible()) await page.getByRole('button', { name: copy.signOut, exact: true }).click()
  await page.locator('#email').fill(email); await page.locator('#password').fill('Demo-only-2026!')
  await page.getByRole('button', { name: copy.signIn, exact: true }).click(); await expect(page.getByRole('heading', { name: copy.signedIn })).toBeVisible()
}
async function axe(page: Page) {
  await page.evaluate(async () => { await document.fonts.ready; document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).forEach(animation => animation.finish()) })
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}
for (const locale of ['en', 'am'] as const) {
  const copy = locale === 'en' ? en : am
  for (const width of [360, 390, 768, 1024, 1440]) test(`HR ${locale} ${width}px totals, navigation, refresh and accessibility`, async ({ page }) => {
    await page.addInitScript(locale => localStorage.setItem('fgae.locale', locale), locale); await page.setViewportSize({ width, height: 900 })
    await login(page, copy); await page.getByRole('link', { name: copy.hrLink }).click()
    await expect(page).toHaveTitle(copy.hrTitle); await expect(page.locator('.workspace-value')).toHaveText(['3', '2', '1', '1'])
    await expect(page.locator('.workspace-records li')).toHaveCount(3); await expect(page.locator('main')).not.toContainText('Demo personnel B'); await axe(page)
    await page.screenshot({ path: `docs/screenshots/hr-${locale}-${width}.png`, fullPage: true, animations: 'disabled' })
    await page.getByRole('button', { name: copy.homeRefresh }).click(); await expect(page.locator('#hr-heading')).toBeFocused(); await expect(page.locator('.workspace-records li')).toHaveCount(3)
    if (locale === 'am') expect(await page.locator('main').innerText()).not.toContain('።')
    await page.getByRole('link', { name: copy.homeOpenAccount }).click(); await expect(page.locator('#acct-name')).toBeVisible()
    await page.goBack(); await expect(page.locator('.workspace-records li')).toHaveCount(3)
    await page.getByRole('button', { name: copy.signOut, exact: true }).click(); await expect(page.getByRole('heading', { name: copy.hrSignIn })).toBeVisible(); await expect(page.locator('.workspace-records')).toHaveCount(0)
  })
}
test('HR access guards, profile continuity, offline retry, expiry and cross-tab clearing', async ({ page, context }) => {
  await page.goto('/workspaces/hr'); await expect(page.getByRole('heading', { name: en.hrSignIn })).toBeVisible()
  await login(page, en, 'volunteer@example.test'); await expect(page.getByRole('link', { name: en.hrLink })).toHaveCount(0)
  await page.goto('/workspaces/hr'); await expect(page.getByRole('heading', { name: en.hrDenied })).toBeVisible()
  await page.emulateMedia({ reducedMotion: 'reduce' }); await login(page); await page.goto('/workspaces/hr'); await expect(page.locator('.workspace-records li')).toHaveCount(3)
  await page.getByRole('link', { name: en.homeOpenAccount }).click(); await page.locator('#acct-phone').fill('+251911111111'); await page.getByRole('button', { name: en.acctSave, exact: true }).click(); await expect(page.getByRole('status')).toContainText(en.acctSaved)
  await page.goto('/workspaces/hr'); await expect(page.getByRole('heading', { name: en.hrContact, exact: true })).toHaveCount(0); await expect(page.getByRole('heading', { name: en.hrJob, exact: true })).toBeVisible()
  await context.setOffline(true); await page.getByRole('button', { name: en.homeRefresh }).click(); await expect(page.getByRole('alert')).toContainText(en.NETWORK); await expect(page.locator('.workspace-metrics')).toHaveCount(0)
  await context.setOffline(false); await page.getByRole('button', { name: en.appRetry }).click(); await expect(page.locator('.workspace-records li')).toHaveCount(3)
  await page.evaluate(() => { const key = 'fgae.synthetic.auth.v1'; sessionStorage.setItem(key, JSON.stringify({ ...JSON.parse(sessionStorage.getItem(key)!), expiresAt: 0 })) })
  await page.getByRole('button', { name: en.homeRefresh }).click(); await expect(page.getByRole('heading', { name: en.hrSignIn })).toBeVisible()
  await login(page); await page.goto('/workspaces/hr'); await expect(page.locator('.workspace-records li')).toHaveCount(3)
  await page.evaluate(() => { const bus = new BroadcastChannel('fgae.auth'); bus.postMessage('signed-out'); bus.close() }); await expect(page.getByRole('heading', { name: en.hrSignIn })).toBeVisible(); await expect(page.locator('.workspace-records')).toHaveCount(0)
  await login(page, en, 'super.admin@example.test'); await page.getByRole('link', { name: en.hrLink }).click(); await expect(page.locator('.workspace-value')).toHaveText(['5', '3', '1', '2'])
})
for (const locale of ['en', 'am'] as const) test(`HR live ${locale} retry, scoped records, empty and authorization`, async ({ page }) => {
  const copy = locale === 'en' ? en : am; await page.addInitScript(locale => localStorage.setItem('fgae.locale', locale), locale)
  const identity = { id: 'hr', display_name: 'HR colleague', email: 'hr@example.test', role_grants: [{ role: 'HR', scope: { kind: 'branch', id: 'a' } }, { role: 'BRANCH_MANAGER', scope: { kind: 'branch', id: 'b' } }], account_status: 'ACTIVE', must_change_password: false }
  await page.route('**/auth/refresh', route => route.fulfill({ json: { success: true, data: { access_token: 'hr-token' } } }))
  await page.route('**/auth/me', route => route.fulfill({ json: { success: true, data: identity } }))
  let status = 503
  let data: Record<string, unknown> = { ownerId: 'hr', generatedAt: '2026-11-17T12:00:00Z', branches: [{ id: 'a', areaId: 'area-a', name: 'Branch A' }], counts: { total: 0, active: 0, onLeave: 0, ended: 0, needsContact: 0, needsJob: 0 }, recent: [] }
  await page.route('**/hr/overview', route => { expect(route.request().headers().authorization).toBe('Bearer hr-token'); return route.fulfill({ status, json: { success: status === 200, data } }) })
  await page.goto('http://127.0.0.1:5174/workspaces/hr'); await expect(page.getByRole('alert')).toContainText(copy.hrUnavailable)
  status = 429; await page.getByRole('button', { name: copy.appRetry }).click(); await expect(page.getByRole('alert')).toContainText(copy.RATE_LIMITED)
  status = 200; await page.getByRole('button', { name: copy.appRetry }).click(); await expect(page.getByRole('heading', { name: copy.hrEmpty })).toBeVisible(); await axe(page)
  data = { ...data, counts: { total: 1, active: 0, onLeave: 1, ended: 0, needsContact: 0, needsJob: 1 }, recent: [{ id: 'p', name: 'Test colleague', branchId: 'a', jobTitle: '', employment: 'ON_LEAVE', account: 'SUSPENDED', needsContact: false, needsJob: true, updatedAt: '2026-11-16T08:00:00Z' }] }
  await page.getByRole('button', { name: copy.homeRefresh }).click(); await expect(page.locator('.hr-records')).toContainText(copy.hrAccountSuspended); await expect(page.locator('.hr-records')).toContainText(copy.hrLeave); await axe(page)
  data = { ...data, ownerId: 'someone-else' }; await page.getByRole('button', { name: copy.homeRefresh }).click(); await expect(page.getByRole('alert')).toContainText(copy.hrUnavailable)
  data = { ...data, ownerId: 'hr', branches: [{ id: 'b', areaId: 'area-b', name: 'Private branch' }] }; await page.getByRole('button', { name: copy.appRetry }).click(); await expect(page.getByRole('alert')).toContainText(copy.hrUnavailable); await expect(page.locator('main')).not.toContainText('Private branch')
  status = 403; await page.getByRole('button', { name: copy.appRetry }).click(); await expect(page.getByRole('heading', { name: copy.hrDenied })).toBeVisible()
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('fgae.synthetic')))).toEqual([])
})
