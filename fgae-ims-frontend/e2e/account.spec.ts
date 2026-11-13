import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { en } from '../src/i18n/locales/en/auth'
import { am } from '../src/i18n/locales/am/auth'
import type { AccountProfile } from '../src/services/contracts/account'
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1sAAAAASUVORK5CYII=', 'base64')
const photo = { name: 'avatar.png', mimeType: 'image/png', buffer: png }
const replacement = 'Another fictional account phrase'
async function login(page: Page, copy: typeof am = en, email = 'volunteer@example.test', password = 'Demo-only-2026!') {
  await page.goto('/sign-in'); await page.locator('#email').fill(email); await page.locator('#password').fill(password)
  await page.getByRole('button', { name: copy.signIn, exact: true }).click(); await expect(page.getByRole('heading', { name: copy.signedIn })).toBeVisible()
}
async function open(page: Page, copy: typeof am = en) { await login(page, copy); await page.getByRole('link', { name: copy.acctLink, exact: true }).click(); await expect(page.locator('#acct-name')).toBeVisible() }
async function axe(page: Page) {
  await page.evaluate(async () => { await document.fonts.ready; document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).forEach(animation => animation.finish()) })
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}
for (const locale of ['en', 'am'] as const) {
  const copy = locale === 'en' ? en : am
  for (const width of [360, 390, 768, 1024, 1440]) test(`account ${locale} ${width}px profile photo language and accessibility`, async ({ page }) => {
    await page.addInitScript(locale => localStorage.setItem('fgae.locale', locale), locale)
    await page.setViewportSize({ width, height: 900 }); await open(page, copy)
    await expect(page).toHaveTitle(copy.acctTitle); await expect(page.locator('input[type="email"]')).toHaveCount(0)
    await axe(page); await page.screenshot({ path: `docs/screenshots/account-${locale}-${width}.png`, fullPage: true, animations: 'disabled' })
    await page.locator('#acct-name').fill('x'); await page.getByRole('button', { name: copy.acctSave, exact: true }).click(); await expect(page.locator('#acct-name')).toBeFocused()
    await page.locator('#acct-name').fill('Updated Volunteer'); await page.locator('#acct-phone').fill('0912345678'); await page.locator('#acct-locale').selectOption(locale)
    await page.locator('#file-photo').setInputFiles(photo); await expect(page.getByRole('link', { name: copy.regPreview })).toBeVisible()
    await page.getByRole('button', { name: copy.acctSave, exact: true }).click(); await expect(page.getByRole('status')).toContainText(copy.acctSaved)
    await page.reload(); await expect(page.locator('#acct-name')).toHaveValue('Updated Volunteer'); await expect(page.locator('#acct-phone')).toHaveValue('+251912345678'); await expect(page.locator('#acct-locale')).toHaveValue(locale)
    await expect(page.locator('.account-photo img')).toBeVisible()
    await page.getByRole('button', { name: copy.regRemove, exact: true }).click(); await page.getByRole('button', { name: copy.acctSave, exact: true }).click(); await expect(page.getByRole('status')).toContainText(copy.acctSaved)
    await page.reload(); await expect(page.locator('.account-photo img')).toHaveCount(0)
    await page.locator('.account-security summary').click(); await axe(page)
    if (locale === 'am') expect(await page.locator('main').innerText()).not.toContain('።')
  })
  test(`account password ${locale} wrong password, confirmation, new sign-in and preserved access`, async ({ page, context }) => {
    await page.addInitScript(locale => localStorage.setItem('fgae.locale', locale), locale)
    await open(page, copy); await page.locator('.account-security summary').click()
    await page.getByRole('button', { name: copy.acctPasswordSave, exact: true }).click(); await expect(page.locator('#acct-currentPassword')).toBeFocused()
    await page.locator('#acct-currentPassword').fill('Wrong-password!'); await page.locator('#acct-password').fill(replacement); await page.locator('#acct-confirmation').fill('mismatch')
    await page.getByRole('button', { name: copy.acctPasswordSave, exact: true }).click(); await expect(page.locator('#acct-confirmation')).toBeFocused()
    await page.locator('#acct-confirmation').fill(replacement); await page.getByRole('button', { name: copy.acctPasswordSave, exact: true }).click(); await expect(page.getByRole('alert')).toContainText(copy.acctWrongPassword)
    await expect(page.locator('#acct-password')).toHaveValue(replacement)
    const session = await page.evaluate(() => sessionStorage.getItem('fgae.synthetic.auth.v1')!)
    const other = await context.newPage(); await other.addInitScript(value => sessionStorage.setItem('fgae.synthetic.auth.v1', value), session); await other.goto('/account'); await expect(other.locator('#acct-name')).toBeVisible()
    await other.locator('#acct-name').fill('Unsaved private edit'); await page.bringToFront()
    await page.locator('#acct-currentPassword').fill('Demo-only-2026!'); await page.getByRole('button', { name: copy.acctPasswordSave, exact: true }).click()
    await expect(page.getByRole('heading', { name: copy.acctPasswordDone })).toBeFocused(); await expect(page.locator('input[type="password"]')).toHaveCount(0)
    await expect(other.locator('#acct-name')).toHaveCount(0); await other.close()
    await axe(page)
    await page.goto('/sign-in'); await page.locator('#email').fill('volunteer@example.test'); await page.locator('#password').fill('Demo-only-2026!'); await page.getByRole('button', { name: copy.signIn, exact: true }).click(); await expect(page.getByRole('alert')).toContainText(copy.INVALID_CREDENTIALS)
    await page.locator('#password').fill(replacement); await page.getByRole('button', { name: copy.signIn, exact: true }).click(); await expect(page.locator('.role-list')).toContainText(copy.VOLUNTEER)
  })
}
test('account unsaved/discard, language, offline, conflict and session guards', async ({ page, context }) => {
  await page.goto('/account'); await expect(page.getByRole('heading', { name: en.acctSignIn })).toBeVisible()
  await page.emulateMedia({ reducedMotion: 'reduce' }); await open(page)
  await page.locator('#acct-name').fill('Local changes'); await page.getByRole('link', { name: en.appAccount }).click(); await expect(page.getByRole('heading', { name: en.acctLeave })).toBeFocused()
  await page.getByRole('button', { name: en.acctKeep }).click(); await expect(page.locator('#acct-name')).toHaveValue('Local changes')
  await context.setOffline(true); await page.getByRole('button', { name: en.acctSave, exact: true }).click(); await expect(page.getByRole('alert')).toContainText(en.NETWORK); await context.setOffline(false)
  await page.getByRole('button', { name: en.acctDiscard, exact: true }).click(); await page.locator('.leave-confirmation').getByRole('button', { name: en.acctDiscard, exact: true }).click(); await expect(page.locator('#acct-name')).toHaveValue('Demo 8')
  const session = await page.evaluate(() => sessionStorage.getItem('fgae.synthetic.auth.v1')!)
  const other = await context.newPage(); await other.addInitScript(value => sessionStorage.setItem('fgae.synthetic.auth.v1', value), session); await other.goto('/account'); await expect(other.locator('#acct-name')).toBeVisible()
  await page.bringToFront(); await page.locator('#acct-name').fill('Saved elsewhere'); await page.getByRole('button', { name: en.acctSave, exact: true }).click(); await expect(page.getByRole('status')).toContainText(en.acctSaved)
  await other.bringToFront(); await other.locator('#acct-name').fill('Second tab edit'); await other.getByRole('button', { name: en.acctSave, exact: true }).click(); await expect(other.getByRole('alert')).toContainText(en.acctConflict); await expect(other.locator('#acct-name')).toHaveValue('Second tab edit')
  await other.getByRole('button', { name: en.acctReload, exact: true }).click(); await other.locator('.leave-confirmation').getByRole('button', { name: en.acctReload, exact: true }).click(); await expect(other.locator('#acct-name')).toHaveValue('Saved elsewhere')
  await other.locator('#acct-name').fill('Private draft'); await other.evaluate(() => { const key = 'fgae.synthetic.auth.v1'; sessionStorage.setItem(key, JSON.stringify({ ...JSON.parse(sessionStorage.getItem(key)!), expiresAt: 0 })) })
  await other.getByRole('button', { name: en.acctSave, exact: true }).click(); await expect(other.getByRole('heading', { name: en.acctSignIn })).toBeVisible(); await expect(other.locator('#acct-name')).toHaveCount(0)
})
test('account live protected save, photo, retry and password completion', async ({ page }) => {
  const identity = { id: 'owner', display_name: 'Test Applicant', email: 'owner@example.test', role_grants: [], account_status: 'PENDING', must_change_password: false }
  let profile: AccountProfile = { ownerId: identity.id, version: 1, name: identity.display_name, phone: '', locale: 'en', photo: null, editableFields: ['phone'] }
  let status = 503
  await page.route('**/auth/refresh', route => route.fulfill({ json: { success: true, data: { access_token: 'test-token' } } }))
  await page.route('**/auth/me', route => route.fulfill({ json: { success: true, data: identity } }))
  await page.route('**/account/me', route => {
    expect(route.request().headers().authorization).toBe('Bearer test-token')
    if (route.request().method() === 'GET') return route.fulfill({ status, json: { success: status === 200, data: { profile } } })
    profile = { ...route.request().postDataJSON(), editableFields: ['phone'], version: profile.version + 1 } as AccountProfile
    return route.fulfill({ json: { success: true, data: profile } })
  })
  await page.goto('http://127.0.0.1:5174/account'); await expect(page.getByRole('alert')).toContainText(en.acctUnavailable)
  status = 200; await page.getByRole('button', { name: en.appRetry }).click(); await expect(page.locator('#acct-name')).toBeDisabled()
  await page.route('**/account/me/photos', route => route.fulfill({ json: { success: true, data: { id: 'photo', typeId: 'photo', name: photo.name, mime: photo.mimeType, size: png.length } } }))
  await page.route('**/photos/photo/content', route => route.fulfill({ contentType: 'image/png', body: png }))
  await page.locator('#file-photo').setInputFiles(photo); await expect(page.getByRole('link', { name: en.regPreview })).toBeVisible(); await page.locator('#acct-phone').fill('+251912345678')
  await page.getByRole('button', { name: en.acctSave, exact: true }).click(); await expect(page.getByRole('status')).toContainText(en.acctSaved)
  await page.locator('.account-security summary').click(); await page.locator('#acct-currentPassword').fill('Current-phrase'); await page.locator('#acct-password').fill(replacement); await page.locator('#acct-confirmation').fill(replacement)
  const keys: string[] = []
  await page.route('**/account/me/password', route => { keys.push(route.request().headers()['idempotency-key']!); return route.fulfill({ status: keys.length === 1 ? 503 : 200, json: keys.length === 1 ? { code: 'UNAVAILABLE' } : { success: true, data: { completed: true } } }) })
  await page.getByRole('button', { name: en.acctPasswordSave, exact: true }).click(); await expect(page.getByRole('alert')).toContainText(en.acctUnavailable)
  await expect(page.locator('#acct-password')).toHaveValue(replacement); await page.getByRole('button', { name: en.acctPasswordSave, exact: true }).click(); await expect(page.getByRole('heading', { name: en.acctPasswordDone })).toBeVisible()
  expect(keys).toHaveLength(2); expect(keys[0]).toBe(keys[1]); expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('fgae.synthetic')))).toEqual([])
})
