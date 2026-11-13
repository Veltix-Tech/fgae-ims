import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { en } from '../src/i18n/locales/en/auth'
import { am } from '../src/i18n/locales/am/auth'
import type { OwnApplication } from '../src/services/contracts/application'

async function login(page: Page, copy = en as typeof am, email = 'pending@example.test') {
  await page.goto('/sign-in')
  await page.locator('#email').fill(email); await page.locator('#password').fill('Demo-only-2026!')
  await page.getByRole('button', { name: copy.signIn, exact: true }).click()
  await expect(page.getByRole('heading', { name: copy.signedIn })).toBeVisible()
}
for (const locale of ['en', 'am'] as const) {
  const copy = locale === 'en' ? en : am
  for (const width of [360, 390, 768, 1024, 1440]) {
    test(`application ${locale} ${width}px own status, accessibility and refresh`, async ({ page }) => {
      await page.addInitScript(locale => localStorage.setItem('fgae.locale', locale), locale)
      await page.setViewportSize({ width, height: 900 })
      await login(page, copy)
      await page.getByRole('link', { name: copy.appLink }).click()
      await expect(page.getByRole('heading', { name: copy.appPending, exact: true })).toBeVisible()
      await expect(page).toHaveTitle(copy.appTitle)
      await expect(page.getByText(copy.appNoDocuments)).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.evaluate(async () => { await Promise.all(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {}))) })
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])
      await page.screenshot({ path: `docs/screenshots/application-${locale}-${width}.png`, fullPage: true, animations: 'disabled' })
      await page.getByText(copy.appDetails, { exact: true }).click()
      await expect(page.getByText(copy.appNoValue).first()).not.toBeVisible()
      await page.getByText(copy.appDetails, { exact: true }).focus(); await page.keyboard.press('Enter')
      await expect(page.getByText(copy.appNoValue).first()).toBeVisible()
      await page.getByRole('button', { name: copy.appRefresh }).click()
      await expect(page.getByRole('heading', { name: copy.appPending, exact: true })).toBeVisible()
      await page.reload()
      await expect(page.getByRole('heading', { name: copy.appPending, exact: true })).toBeVisible()
      if (locale === 'am') expect(await page.locator('main').innerText()).not.toContain('።')
    })
  }
}
test('application direct access, role denial, offline retry, expiry and cross-tab invalidation', async ({ page, context }) => {
  await page.goto('/my-application'); await expect(page.getByRole('heading', { name: en.appSignIn })).toBeVisible()
  await login(page, en, 'hr@example.test')
  await expect(page.getByRole('link', { name: en.appLink })).toHaveCount(0)
  await page.goto('/my-application'); await expect(page.getByRole('heading', { name: en.appDenied })).toBeVisible()
  await page.goto('/sign-in'); await page.getByRole('button', { name: en.signOut, exact: true }).click()
  await login(page)
  await page.goto('/my-application'); await expect(page.getByRole('heading', { name: en.appPending, exact: true })).toBeVisible()
  await context.setOffline(true); await page.getByRole('button', { name: en.appRefresh }).click()
  await expect(page.getByRole('alert')).toContainText(en.NETWORK)
  await expect(page.getByText('pending@example.test', { exact: true })).toHaveCount(0)
  await context.setOffline(false); await page.getByRole('button', { name: en.appRetry }).click()
  await expect(page.getByRole('heading', { name: en.appPending, exact: true })).toBeVisible()
  await page.evaluate(() => { const key = 'fgae.synthetic.auth.v1'; sessionStorage.setItem(key, JSON.stringify({ ...JSON.parse(sessionStorage.getItem(key)!), expiresAt: 0 })) })
  await page.getByRole('button', { name: en.appRefresh }).click(); await expect(page.getByRole('heading', { name: en.appSignIn })).toBeVisible()
  await login(page); await page.goto('/my-application')
  await expect(page.getByRole('heading', { name: en.appPending, exact: true })).toBeVisible()
  const other = await context.newPage(); await other.goto('/sign-in')
  await other.evaluate(() => { const bus = new BroadcastChannel('fgae.auth'); bus.postMessage('account-changed'); bus.close() })
  await page.bringToFront()
  await expect(page.getByRole('heading', { name: en.appSignIn })).toBeVisible()
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByText('pending@example.test', { exact: true })).toHaveCount(0)
})

test('application approved volunteer, language persistence, reduced motion and sign out', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await login(page, en, 'volunteer@example.test')
  await page.getByRole('link', { name: en.appLink }).click()
  await expect(page.getByRole('heading', { name: en.appApproved, exact: true })).toBeVisible()
  await expect(page.locator('.application-history li')).toHaveCount(2)
  await page.locator('#language').click(); await page.getByRole('button', { name: en.amharic, exact: true }).click()
  await expect(page.getByRole('heading', { name: am.appApproved, exact: true })).toBeVisible()
  await page.reload(); await expect(page).toHaveTitle(am.appTitle)
  expect(await page.locator('.application-page').evaluate(element => getComputedStyle(element).animationName)).toBe('none')
  await page.getByRole('button', { name: am.signOut, exact: true }).click()
  await expect(page.getByRole('heading', { name: am.appSignIn })).toBeVisible()
  await expect(page.getByText('volunteer@example.test', { exact: true })).toHaveCount(0)
  await page.reload(); await expect(page.getByRole('heading', { name: am.appSignIn })).toBeVisible()
})

for (const locale of ['en', 'am'] as const) {
  const copy = locale === 'en' ? en : am
  test(`application live ${locale} decisions, empty, errors and owner isolation`, async ({ page }) => {
    await page.addInitScript(locale => localStorage.setItem('fgae.locale', locale), locale)
    await page.setViewportSize({ width: locale === 'am' ? 390 : 1440, height: 900 })
    const at = '2026-11-10T08:00:00.000Z'
    const identity = { id: 'owner-a', display_name: 'Test Applicant', email: 'owner@example.test', role_grants: [], account_status: 'PENDING', must_change_password: false }
    const initial: OwnApplication = { id: 'APP-001', ownerId: identity.id, status: 'PENDING', submittedAt: at, updatedAt: at,
      fields: { fullName: identity.display_name, email: identity.email, phone: '+251912345678', birthDate: '2000-02-29', gender: 'FEMALE', branchId: 'branch-a' }, branchName: 'Test branch',
      documents: [{ id: 'proof', typeId: 'identity', name: 'identity.png', mime: 'image/png', size: 1024 }], history: [{ id: 'sent', status: 'PENDING', at, note: '' }] }
    let application: OwnApplication | null = initial
    let status = 200
    await page.route('**/auth/refresh', route => route.fulfill({ json: { success: true, data: { access_token: 'test-only-token' } } }))
    await page.route('**/auth/me', route => route.fulfill({ json: { success: true, data: identity } }))
    await page.route('**/volunteers/applications/me', async route => {
      expect(route.request().headers().authorization).toBe('Bearer test-only-token')
      await route.fulfill({ status, json: { success: status === 200, data: { application } } })
    })
    await page.goto('http://127.0.0.1:5174/my-application')
    await expect(page.getByRole('heading', { name: copy.appPending, exact: true })).toBeVisible()
    for (const [decision, heading] of [['RETURNED', copy.appReturned], ['REJECTED', copy.appRejected], ['APPROVED', copy.appApproved]] as const) {
      application = { ...initial, status: decision, history: [...initial.history, { id: decision, status: decision, at, note: 'Please contact the branch. <script>plain text</script>' }] }
      await page.getByRole('button', { name: copy.appRefresh }).click()
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
      await expect(page.locator('.decision-note')).toContainText('<script>plain text</script>')
      await page.evaluate(async () => { await Promise.all(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {}))) })
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])
      await page.screenshot({ path: `docs/screenshots/application-${locale}-${decision}.png`, fullPage: true, animations: 'disabled' })
    }
    application = { ...initial, ownerId: 'another-owner' }
    await page.getByRole('button', { name: copy.appRefresh }).click(); await expect(page.getByRole('alert')).toContainText(copy.appUnavailable)
    await expect(page.getByText(identity.email, { exact: true })).toHaveCount(0)
    application = null
    await page.getByRole('button', { name: copy.appRetry }).click(); await expect(page.getByRole('heading', { name: copy.appEmpty })).toBeVisible()
    status = 429
    await page.getByRole('button', { name: copy.appRefresh }).click(); await expect(page.getByRole('alert')).toContainText(copy.RATE_LIMITED)
    status = 503
    await page.getByRole('button', { name: copy.appRetry }).click(); await expect(page.getByRole('alert')).toContainText(copy.appUnavailable)
    status = 403
    await page.getByRole('button', { name: copy.appRetry }).click(); await expect(page.getByRole('heading', { name: copy.appDenied })).toBeVisible()
    status = 200; application = initial
    await page.reload(); await expect(page.getByRole('heading', { name: copy.appPending, exact: true })).toBeVisible()
    let logoutStatus = 503
    await page.route('**/auth/logout', route => route.fulfill({ status: logoutStatus, json: { success: logoutStatus === 200, data: {} } }))
    await page.getByRole('button', { name: copy.signOut, exact: true }).click()
    await expect(page.getByRole('alert')).toContainText(copy.logoutFailed)
    await expect(page.getByText(identity.email, { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: copy.appRetry }).click()
    await expect(page.getByRole('heading', { name: copy.appPending, exact: true })).toBeVisible()
    logoutStatus = 200
    await page.getByRole('button', { name: copy.signOut, exact: true }).click()
    await expect(page.getByRole('heading', { name: copy.appSignIn })).toBeVisible()
    expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('fgae.synthetic')))).toEqual([])
  })
}
