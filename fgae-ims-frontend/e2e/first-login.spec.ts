import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { en } from '../src/i18n/locales/en/auth'
import { am } from '../src/i18n/locales/am/auth'

const password = 'A new private fictional phrase'
async function login(page: Page, copy: typeof am, email = 'first.login@example.test') {
  await page.goto('/sign-in')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill('Demo-only-2026!')
  await page.getByRole('button', { name: copy.signIn, exact: true }).click()
  await expect(page.getByRole('heading', { name: copy.signedIn })).toBeVisible()
}
async function fill(page: Page, current = 'Demo-only-2026!') {
  await page.locator('#current-password').fill(current)
  await page.locator('#new-password').fill(password)
  await page.locator('#confirm-password').fill(password)
}
for (const locale of ['en', 'am'] as const) {
  const copy = locale === 'en' ? en : am
  for (const width of [360, 390, 768, 1024, 1440]) {
    test(`first-login ${locale} ${width}px validation and accessible completion`, async ({ page }) => {
      await page.addInitScript(locale => localStorage.setItem('fgae.locale', locale), locale)
      await page.setViewportSize({ width, height: 900 })
      await login(page, copy)
      await page.getByRole('link', { name: copy.firstContinue, exact: true }).click()
      await expect(page.getByRole('heading', { name: copy.firstHeading })).toBeVisible()
      await expect(page).toHaveTitle(copy.firstTitle)
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({ path: `docs/screenshots/first-${locale}-${width}.png`, fullPage: true, animations: 'disabled' })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])
      await page.getByRole('button', { name: copy.firstSubmit }).click()
      await expect(page.locator('#current-password')).toBeFocused()
      await fill(page)
      await page.locator('#confirm-password').fill('mismatch')
      await page.getByRole('button', { name: copy.firstSubmit }).click()
      await expect(page.locator('#confirm-password')).toBeFocused()
      await expect(page.getByText(copy.resetMismatch, { exact: true })).toBeVisible()
      await page.getByRole('button', { name: copy.firstShowCurrent }).click()
      await expect(page.locator('#current-password')).toHaveAttribute('type', 'text')
      await page.getByRole('button', { name: copy.resetShowNew }).click()
      await expect(page.locator('#new-password')).toHaveAttribute('type', 'text')
      await page.locator('#confirm-password').fill(password)
      await page.getByRole('button', { name: copy.firstSubmit }).click()
      await expect(page.getByRole('heading', { name: copy.resetSuccessHeading })).toBeFocused()
      await expect(page.locator('input')).toHaveCount(0)
      await page.screenshot({ path: `docs/screenshots/first-success-${locale}-${width}.png`, fullPage: true, animations: 'disabled' })
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([])
      if (locale === 'am') expect(await page.locator('body').innerText()).not.toContain('።')
    })
  }
  test(`first-login ${locale} wrong credential, persistent replacement and guards`, async ({ page }) => {
    await page.addInitScript(locale => localStorage.setItem('fgae.locale', locale), locale)
    await page.goto('/first-login')
    await expect(page.getByRole('heading', { name: copy.firstSignInHeading })).toBeVisible()
    await expect(page.locator('input')).toHaveCount(0)
    await login(page, copy)
    await page.getByRole('link', { name: copy.firstContinue, exact: true }).click()
    await fill(page, 'Wrong-temporary-password')
    await page.getByRole('button', { name: copy.firstSubmit }).click()
    await expect(page.getByRole('alert')).toContainText(copy.firstWrong)
    await expect(page.locator('#new-password')).toHaveValue(password)
    await page.locator('#current-password').fill('Demo-only-2026!')
    await page.getByRole('button', { name: copy.firstSubmit }).click()
    await expect(page.getByRole('heading', { name: copy.resetSuccessHeading })).toBeVisible()
    await page.getByRole('link', { name: copy.resetSignIn }).click()
    await page.locator('#email').fill('first.login@example.test')
    await page.locator('#password').fill('Demo-only-2026!')
    await page.getByRole('button', { name: copy.signIn, exact: true }).click()
    await expect(page.getByRole('alert')).toContainText(copy.INVALID_CREDENTIALS)
    await page.locator('#password').fill(password)
    await page.getByRole('button', { name: copy.signIn, exact: true }).click()
    await expect(page.getByRole('heading', { name: copy.signedIn })).toBeVisible()
    await expect(page.getByRole('link', { name: copy.firstContinue, exact: true })).toHaveCount(0)
    await page.reload()
    await expect(page.getByRole('heading', { name: copy.signedIn })).toBeVisible()
    await page.goto('/first-login')
    await expect(page.getByRole('heading', { name: copy.firstDoneHeading })).toBeVisible()
    await expect(page.locator('input')).toHaveCount(0)
  })
}
test('first-login locale, offline retry, unsaved sign-out and draft refresh', async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await login(page, en)
  await page.getByRole('link', { name: en.firstContinue, exact: true }).click()
  await fill(page)
  await page.locator('#language').click()
  await page.locator('#language-options').getByRole('button', { name: 'አማርኛ', exact: true }).click()
  await expect(page.locator('#new-password')).toHaveValue(password)
  await expect(page.locator('.form-panel')).toHaveCSS('animation-name', 'none')
  await context.setOffline(true)
  await page.getByRole('button', { name: am.firstSubmit }).click()
  await expect(page.getByRole('alert')).toContainText(am.NETWORK)
  await context.setOffline(false)
  await page.getByRole('button', { name: am.signOut, exact: true }).click()
  await expect(page.getByRole('heading', { name: am.resetLeaveHeading })).toBeFocused()
  await page.getByRole('button', { name: am.resetKeepEditing }).click()
  await expect(page.getByRole('button', { name: am.signOut, exact: true })).toBeFocused()
  page.once('dialog', dialog => dialog.accept())
  await page.reload()
  await expect(page.locator('#current-password')).toHaveValue('')
  await expect(page.locator('#new-password')).toHaveValue('')
  await fill(page)
  await page.getByRole('button', { name: am.signOut, exact: true }).click()
  await page.getByRole('button', { name: am.firstDiscardSignOut }).click()
  await expect(page.getByRole('heading', { name: am.firstSignInHeading })).toBeVisible()
  await expect(page.locator('input')).toHaveCount(0)
})
test('first-login expired session clears credentials and blocks submission', async ({ page }) => {
  await login(page, en)
  await page.getByRole('link', { name: en.firstContinue, exact: true }).click()
  await fill(page)
  await page.evaluate(() => {
    const key = 'fgae.synthetic.auth.v1'
    sessionStorage.setItem(key, JSON.stringify({ ...JSON.parse(sessionStorage.getItem(key)!), expiresAt: 0 }))
  })
  await page.getByRole('button', { name: en.firstSubmit }).click()
  await expect(page.getByRole('heading', { name: en.firstSignInHeading })).toBeFocused()
  await expect(page.locator('input')).toHaveCount(0)
})
test('live first-login restricted identity, busy policy failure, idempotent retry and no mock fallback', async ({ page }) => {
  await page.route('**/auth/refresh', route => route.fulfill({ status: 503, json: {} }))
  await page.route('**/auth/me', route => route.fulfill({ json: { success: true, data: {
    id: 'test-only', display_name: 'Test Account', email: 'test@example.invalid', account_status: 'ACTIVE', must_change_password: true,
    role_grants: [{ role: 'VOLUNTEER', scope: { kind: 'self', id: 'test-only' } }],
  } } }))
  await page.goto('http://127.0.0.1:5174/first-login')
  await expect(page.getByRole('heading', { name: en.firstCheckFailed })).toBeVisible()
  await page.route('**/auth/refresh', route => route.fulfill({ json: { success: true, data: { access_token: 'restricted-test' } } }))
  await page.getByRole('button', { name: en.resetRetry }).click()
  await fill(page)
  await page.route('**/auth/logout', route => route.fulfill({ status: 503, json: {} }))
  await page.getByRole('button', { name: en.signOut, exact: true }).click()
  await page.getByRole('button', { name: en.firstDiscardSignOut }).click()
  await expect(page.getByRole('alert')).toContainText(en.logoutFailed)
  await expect(page.locator('#new-password')).toHaveValue(password)
  await page.getByRole('button', { name: en.resetKeepEditing }).click()
  // A failed logout clears the memory token. Simulate the backend requiring renewal before saving.
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const keys: string[] = []
  await page.route('**/auth/first-login/password', async route => {
    keys.push(route.request().headers()['idempotency-key']!)
    if (!route.request().headers().authorization) {
      await route.fulfill({ status: 401, json: { code: 'SESSION_EXPIRED' } }); return
    }
    expect(route.request().headers().authorization).toBe('Bearer restricted-test')
    await gate
    await route.fulfill({ status: 422, json: { code: 'PASSWORD_REJECTED' } })
  })
  await page.getByRole('button', { name: en.firstSubmit }).click()
  await expect(page.getByRole('button', { name: en.resetSubmitting })).toBeDisabled()
  release()
  await expect(page.getByRole('alert')).toContainText(en.resetRejected)
  await expect(page.locator('#new-password')).toHaveValue(password)
  await page.route('**/auth/first-login/password', async route => {
    keys.push(route.request().headers()['idempotency-key']!)
    await route.fulfill({ json: { success: true, data: { completed: true } } })
  })
  await page.getByRole('button', { name: en.firstSubmit }).click()
  await expect(page.getByRole('heading', { name: en.resetSuccessHeading })).toBeFocused()
  expect(keys).toHaveLength(3); expect(new Set(keys).size).toBe(1)
  expect(await page.evaluate(() => localStorage.getItem('fgae.synthetic.credentials.v1'))).toBeNull()
})
test('first-login session change from another tab clears an unfinished form', async ({ page, context }) => {
  await login(page, en)
  await page.getByRole('link', { name: en.firstContinue, exact: true }).click()
  await fill(page)
  const other = await context.newPage()
  await login(other, en, 'volunteer@example.test')
  await page.bringToFront()
  await expect(page.getByRole('heading', { name: en.firstSignInHeading })).toBeVisible()
  await expect(page.locator('input')).toHaveCount(0)
})
