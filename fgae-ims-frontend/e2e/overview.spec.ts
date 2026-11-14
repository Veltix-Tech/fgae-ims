import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { en } from '../src/i18n/locales/en/auth'
import { am } from '../src/i18n/locales/am/auth'
async function login(page: Page, copy: typeof am = en, email = 'super.admin@example.test') {
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
  for (const width of [360, 390, 768, 1024, 1440]) test(`overview ${locale} ${width}px totals, navigation, refresh and accessibility`, async ({ page }) => {
    await page.addInitScript(locale => localStorage.setItem('fgae.locale', locale), locale); await page.setViewportSize({ width, height: 900 })
    await login(page, copy); await page.getByRole('link', { name: copy.homeLink }).click()
    await expect(page).toHaveTitle(copy.homeTitle); await expect(page.locator('.workspace-value')).toHaveText(['3', '1', '1', '1'])
    await expect(page.locator('.workspace-records li')).toHaveCount(3); await axe(page)
    await page.screenshot({ path: `docs/screenshots/overview-${locale}-${width}.png`, fullPage: true, animations: 'disabled' })
    await page.getByRole('button', { name: copy.homeRefresh }).click(); await expect(page.locator('#overview-heading')).toBeFocused(); await expect(page.locator('.workspace-records li')).toHaveCount(3)
    if (locale === 'am') expect(await page.locator('main').innerText()).not.toContain('።')
    await page.getByRole('link', { name: copy.homeOpenAccount }).click(); await expect(page.locator('#acct-name')).toBeVisible()
    await page.goBack(); await expect(page.locator('.workspace-records li')).toHaveCount(3)
    await page.getByRole('button', { name: copy.signOut, exact: true }).click(); await expect(page.getByRole('heading', { name: copy.homeSignIn })).toBeVisible(); await expect(page.locator('.workspace-records')).toHaveCount(0)
  })
}
test('overview direct guards, offline retry, expiry and cross-tab clearing', async ({ page, context }) => {
  await page.goto('/workspaces/super-admin'); await expect(page.getByRole('heading', { name: en.homeSignIn })).toBeVisible()
  await login(page, en, 'volunteer@example.test'); await expect(page.getByRole('link', { name: en.homeLink })).toHaveCount(0)
  await page.goto('/workspaces/super-admin'); await expect(page.getByRole('heading', { name: en.homeDenied })).toBeVisible()
  await page.emulateMedia({ reducedMotion: 'reduce' }); await login(page); await page.goto('/workspaces/super-admin'); await expect(page.locator('.workspace-records li')).toHaveCount(3)
  await context.setOffline(true); await page.getByRole('button', { name: en.homeRefresh }).click(); await expect(page.getByRole('alert')).toContainText(en.NETWORK); await expect(page.locator('.workspace-metrics')).toHaveCount(0)
  await context.setOffline(false); await page.getByRole('button', { name: en.appRetry }).click(); await expect(page.locator('.workspace-records li')).toHaveCount(3)
  await page.evaluate(() => { const key = 'fgae.synthetic.auth.v1'; sessionStorage.setItem(key, JSON.stringify({ ...JSON.parse(sessionStorage.getItem(key)!), expiresAt: 0 })) })
  await page.getByRole('button', { name: en.homeRefresh }).click(); await expect(page.getByRole('heading', { name: en.homeSignIn })).toBeVisible()
  await login(page); await page.goto('/workspaces/super-admin'); await expect(page.locator('.workspace-records li')).toHaveCount(3)
  await page.evaluate(() => { const bus = new BroadcastChannel('fgae.auth'); bus.postMessage('signed-out'); bus.close() }); await expect(page.getByRole('heading', { name: en.homeSignIn })).toBeVisible(); await expect(page.locator('.workspace-records')).toHaveCount(0)
})
for (const locale of ['en', 'am'] as const) test(`overview live ${locale} errors, empty, ownership and denied response`, async ({ page }) => {
  const copy = locale === 'en' ? en : am; await page.addInitScript(locale => localStorage.setItem('fgae.locale', locale), locale)
  const identity = { id: 'admin', display_name: 'Admin', email: 'admin@example.test', role_grants: [{ role: 'SYSTEM_ADMIN', scope: { kind: 'global', id: '*' } }], account_status: 'ACTIVE', must_change_password: false }
  await page.route('**/auth/refresh', route => route.fulfill({ json: { success: true, data: { access_token: 'overview-token' } } }))
  await page.route('**/auth/me', route => route.fulfill({ json: { success: true, data: identity } }))
  let status = 503; let ownerId = 'admin'
  await page.route('**/super-admin/overview', route => { expect(route.request().headers().authorization).toBe('Bearer overview-token'); return route.fulfill({ status, json: { success: status === 200, data: { ownerId, scope: 'global', generatedAt: '2026-11-14T12:00:00Z', counts: { PENDING: 0, RETURNED: 0, APPROVED: 0, REJECTED: 0 }, recent: [] } } }) })
  await page.goto('http://127.0.0.1:5174/workspaces/super-admin'); await expect(page.getByRole('alert')).toContainText(copy.homeUnavailable)
  status = 429; await page.getByRole('button', { name: copy.appRetry }).click(); await expect(page.getByRole('alert')).toContainText(copy.RATE_LIMITED)
  status = 200; await page.getByRole('button', { name: copy.appRetry }).click(); await expect(page.getByRole('heading', { name: copy.homeEmpty })).toBeVisible(); await axe(page)
  ownerId = 'another'; await page.getByRole('button', { name: copy.homeRefresh }).click(); await expect(page.getByRole('alert')).toContainText(copy.homeUnavailable); await expect(page.locator('.workspace-metrics')).toHaveCount(0)
  status = 403; await page.getByRole('button', { name: copy.appRetry }).click(); await expect(page.getByRole('heading', { name: copy.homeDenied })).toBeVisible()
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('fgae.synthetic')))).toEqual([])
})
