import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { en } from '../src/i18n/locales/en/auth'
import { am } from '../src/i18n/locales/am/auth'
import { registrationConfig } from '../src/mocks/registration'
import type { CorrectionContext } from '../src/services/contracts/corrections'
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1sAAAAASUVORK5CYII=', 'base64')
const proof = { name: 'correction.png', mimeType: 'image/png', buffer: png }
async function login(page: Page, copy: typeof am = en, email = 'returned@example.test') {
  await page.goto('/sign-in'); await page.locator('#email').fill(email); await page.locator('#password').fill('Demo-only-2026!')
  await page.getByRole('button', { name: copy.signIn, exact: true }).click(); await expect(page.getByRole('heading', { name: copy.signedIn })).toBeVisible()
}
async function open(page: Page, copy: typeof am = en) {
  await login(page, copy); await page.getByRole('link', { name: copy.appLink }).click()
  await page.getByRole('link', { name: copy.corrLink }).click(); await expect(page.locator('#corr-phone')).toBeVisible()
}
async function axe(page: Page) {
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {}))) })
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}
for (const locale of ['en', 'am'] as const) {
  const copy = locale === 'en' ? en : am
  for (const width of [360, 390, 768, 1024, 1440]) test(`corrections ${locale} ${width}px validate, upload, review and resubmit`, async ({ page }) => {
    await page.addInitScript(locale => localStorage.setItem('fgae.locale', locale), locale)
    await page.setViewportSize({ width, height: 900 }); await open(page, copy)
    await expect(page).toHaveTitle(copy.corrTitle); await expect(page.locator('#corr-email')).toHaveCount(0)
    await axe(page); await page.screenshot({ path: `docs/screenshots/corrections-${locale}-${width}.png`, fullPage: true, animations: 'disabled' })
    await page.locator('#corr-phone').fill('bad'); await page.getByRole('button', { name: copy.corrReviewButton }).click()
    await expect(page.locator('#corr-phone')).toBeFocused(); await expect(page.locator('#corr-phone-error')).toContainText(copy.regPhoneInvalid)
    await page.locator('#corr-phone').fill('0912345678'); await page.locator('#corr-branchId').selectOption('fictional-branch-b')
    await page.getByRole('button', { name: copy.corrReviewButton }).click(); await expect(page.getByRole('alert')).toContainText(copy.regDocumentMissing)
    await page.locator('#file-identity').setInputFiles(proof); await expect(page.getByRole('link', { name: copy.regPreview })).toBeVisible()
    await page.getByRole('button', { name: copy.regSaveDraft, exact: true }).click(); await expect(page.getByRole('status')).toContainText(copy.corrSaved)
    await page.getByRole('button', { name: copy.corrReviewButton }).click(); await expect(page.locator('.correction-review')).toContainText('0912345678')
    await axe(page); await page.screenshot({ path: `docs/screenshots/corrections-review-${locale}-${width}.png`, fullPage: true, animations: 'disabled' })
    await page.getByRole('button', { name: copy.corrSubmit }).click(); await expect(page.locator('#corr-confirmed')).toBeFocused()
    await page.locator('#corr-confirmed').check(); await page.getByRole('button', { name: copy.corrSubmit }).click()
    await expect(page.getByRole('heading', { name: copy.corrSuccess })).toBeFocused()
    await axe(page); await page.screenshot({ path: `docs/screenshots/corrections-success-${locale}-${width}.png`, fullPage: true, animations: 'disabled' })
    if (locale === 'am') expect(await page.locator('main').innerText()).not.toContain('።')
    await page.getByRole('link', { name: copy.appLink }).click()
    await expect(page.getByRole('heading', { name: copy.appPending, exact: true })).toBeVisible()
    await expect(page.locator('.application-history li')).toHaveCount(3); await expect(page.locator('.application-details')).toContainText('+251912345678')
    await expect(page.locator('.application-files')).toContainText(proof.name)
    await expect(page.getByRole('link', { name: copy.corrLink })).toHaveCount(0)
    await page.reload(); await expect(page.locator('.application-history li')).toHaveCount(3)
    await page.goto('/my-application/edit'); await expect(page.getByRole('heading', { name: copy.corrNotReturned })).toBeVisible()
  })
}
test('correction draft restoration, language, unsaved exit, offline retry and delete', async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await open(page)
  await page.locator('#corr-phone').fill('0912345678'); await page.locator('#file-identity').setInputFiles(proof)
  await expect(page.getByRole('link', { name: en.regPreview })).toBeVisible()
  await page.getByRole('button', { name: en.regSaveDraft, exact: true }).click(); await expect(page.getByRole('status')).toContainText(en.corrSaved)
  await page.reload(); await expect(page.locator('#corr-phone')).toHaveValue('0912345678'); await expect(page.getByRole('link', { name: en.regPreview })).toBeVisible()
  await page.locator('#corr-phone').fill('0912999999'); await page.getByRole('link', { name: en.corrBack }).click()
  await expect(page.getByRole('heading', { name: en.regLeaveHeading })).toBeFocused()
  await page.getByRole('button', { name: en.resetKeepEditing }).click(); await expect(page.locator('#corr-phone')).toHaveValue('0912999999')
  await context.setOffline(true); await page.getByRole('button', { name: en.regSaveDraft, exact: true }).click(); await expect(page.getByRole('alert')).toContainText(en.NETWORK)
  await expect(page.locator('#corr-phone')).toHaveValue('0912999999'); await context.setOffline(false)
  await page.getByRole('button', { name: en.regSaveDraft, exact: true }).click(); await expect(page.getByRole('status')).toContainText(en.corrSaved)
  await page.locator('#language').click(); await page.getByRole('button', { name: en.amharic, exact: true }).click()
  await expect(page.locator('#corr-phone')).toHaveValue('0912999999'); await page.reload(); await expect(page).toHaveTitle(am.corrTitle)
  expect(await page.locator('.correction-page').evaluate(element => getComputedStyle(element).animationName)).toBe('none')
  await page.getByRole('button', { name: am.regDiscardDraft }).click(); await page.getByRole('button', { name: am.corrDeleteAction }).click()
  await expect(page.locator('#corr-phone')).toHaveValue('+251911111111'); await expect(page.getByRole('link', { name: am.regPreview })).toHaveCount(0)
  await page.reload(); await expect(page.locator('#corr-phone')).toHaveValue('+251911111111')
})
test('correction draft conflict keeps local edits until explicit reload', async ({ page, context }) => {
  await open(page)
  const session = await page.evaluate(() => sessionStorage.getItem('fgae.synthetic.auth.v1')!)
  const other = await context.newPage(); await other.addInitScript(value => sessionStorage.setItem('fgae.synthetic.auth.v1', value), session)
  await other.goto('/my-application/edit'); await expect(other.locator('#corr-phone')).toBeVisible()
  await page.bringToFront(); await page.locator('#corr-phone').fill('0912222222'); await page.getByRole('button', { name: en.regSaveDraft, exact: true }).click()
  await expect(page.getByRole('status')).toContainText(en.corrSaved)
  await other.bringToFront(); await other.locator('#corr-phone').fill('0913333333'); await other.getByRole('button', { name: en.regSaveDraft, exact: true }).click()
  await expect(other.getByRole('alert')).toContainText(en.corrConflict); await expect(other.locator('#corr-phone')).toHaveValue('0913333333')
  await other.getByRole('button', { name: en.corrReload, exact: true }).click(); await expect(other.getByRole('heading', { name: en.corrReloadHeading })).toBeFocused()
  await other.locator('.leave-confirmation').getByRole('button', { name: en.corrReload, exact: true }).click()
  await expect(other.locator('#corr-phone')).toHaveValue('0912222222')
})
test('correction direct-access gates, expiry and cross-tab account change clear edits', async ({ page, context }) => {
  await page.goto('/my-application/edit'); await expect(page.getByRole('heading', { name: en.appSignIn })).toBeVisible()
  await login(page, en, 'pending@example.test'); await page.goto('/my-application/edit'); await expect(page.getByRole('heading', { name: en.corrNotReturned })).toBeVisible()
  await page.goto('/sign-in'); await page.getByRole('button', { name: en.signOut, exact: true }).click()
  await open(page); await page.locator('#corr-phone').fill('0912345678')
  await page.evaluate(() => { const key = 'fgae.synthetic.auth.v1'; sessionStorage.setItem(key, JSON.stringify({ ...JSON.parse(sessionStorage.getItem(key)!), expiresAt: 0 })) })
  await page.getByRole('button', { name: en.regSaveDraft, exact: true }).click(); await expect(page.getByRole('heading', { name: en.appSignIn })).toBeVisible()
  await expect(page.locator('#corr-phone')).toHaveCount(0)
  await open(page); await page.locator('#corr-phone').fill('0912345678')
  const other = await context.newPage(); await other.goto('/sign-in'); await other.evaluate(() => { const bus = new BroadcastChannel('fgae.auth'); bus.postMessage('account-changed'); bus.close() })
  await page.bringToFront(); await expect(page.getByRole('heading', { name: en.appSignIn })).toBeVisible(); await expect(page.locator('#corr-phone')).toHaveCount(0)
})

for (const locale of ['en', 'am'] as const) test(`correction live ${locale} upload cancellation, conflicts and idempotent retry`, async ({ page }) => {
  const copy = locale === 'en' ? en : am
  await page.addInitScript(locale => localStorage.setItem('fgae.locale', locale), locale)
  await page.setViewportSize({ width: locale === 'en' ? 1440 : 390, height: 900 })
  const submittedAt = '2026-11-10T08:00:00.000Z'; const returnedAt = '2026-11-12T08:00:00.000Z'
  const owner = { id: 'owner', display_name: 'Test Applicant', email: 'owner@example.test', role_grants: [], account_status: 'PENDING', must_change_password: false }
  const value: CorrectionContext = { revision: 2, draftVersion: 0, draft: null, editableFields: ['phone', 'branchId'], documentTypes: ['identity'], config: registrationConfig,
    application: { id: 'APP-01', ownerId: owner.id, status: 'RETURNED', submittedAt, updatedAt: returnedAt, fields: { fullName: owner.display_name, email: owner.email, phone: '+251911111111', birthDate: '2000-02-29', gender: 'UNDISCLOSED', branchId: 'fictional-branch-a' }, branchName: 'Test branch', documents: [], history: [{ id: 'one', status: 'PENDING', at: submittedAt, note: '' }, { id: 'two', status: 'RETURNED', at: returnedAt, note: 'Please correct your phone and document.' }] },
  }
  await page.route('**/auth/refresh', route => route.fulfill({ json: { success: true, data: { access_token: 'test-token' } } }))
  await page.route('**/auth/me', route => route.fulfill({ json: { success: true, data: owner } }))
  value.config = { ...registrationConfig, branches: [] }
  let loadStatus = 503
  await page.route('**/corrections', route => route.fulfill({ status: loadStatus, json: { success: loadStatus === 200, data: value } }))
  await page.goto('http://127.0.0.1:5174/my-application/edit'); await expect(page.getByRole('alert')).toContainText(copy.corrUnavailable)
  loadStatus = 200; await page.getByRole('button', { name: copy.appRetry }).click(); await expect(page.locator('#corr-phone')).toBeVisible()
  await expect(page.getByRole('status')).toContainText(copy.regEmptyBranches)
  await expect(page.getByRole('button', { name: copy.corrReviewButton })).toBeDisabled()
  value.config = registrationConfig
  await page.getByRole('button', { name: copy.corrReload, exact: true }).click()
  await page.locator('.leave-confirmation').getByRole('button', { name: copy.corrReload, exact: true }).click()
  await expect(page.locator('#corr-phone')).toBeVisible()
  let upload = 0
  await page.route('**/corrections/documents', async route => {
    expect(route.request().headers().authorization).toBe('Bearer test-token'); upload++
    if (upload === 1) { await new Promise(resolve => setTimeout(resolve, 1500)); await route.abort().catch(() => {}); return }
    await route.fulfill({ json: { success: true, data: { id: 'uploaded', typeId: 'identity', name: proof.name, mime: proof.mimeType, size: png.length } } })
  })
  await page.route('**/documents/uploaded/content', route => route.fulfill({ contentType: 'image/png', body: png }))
  await page.locator('#file-identity').setInputFiles(proof); await page.getByRole('button', { name: copy.regCancelUpload }).click()
  await expect(page.getByRole('alert')).toContainText(copy.regUploadCancelled)
  await page.getByRole('button', { name: copy.resetRetry, exact: true }).click(); await expect(page.getByRole('link', { name: copy.regPreview })).toBeVisible()
  await page.locator('#corr-phone').fill('0912345678')
  let draftConflict = true
  await page.route('**/corrections/draft', route => {
    if (draftConflict) return route.fulfill({ status: 409, json: { code: 'DRAFT_CONFLICT' } })
    const body = route.request().postDataJSON() as CorrectionInputForTest
    value.draftVersion++; value.draft = { fields: body.fields, documents: body.documents, revision: 2, version: value.draftVersion, updatedAt: new Date().toISOString() }
    return route.fulfill({ json: { success: true, data: value.draft } })
  })
  await page.getByRole('button', { name: copy.regSaveDraft, exact: true }).click(); await expect(page.getByRole('alert')).toContainText(copy.corrConflict)
  await expect(page.locator('#corr-phone')).toHaveValue('0912345678')
  await page.getByRole('button', { name: copy.corrReload, exact: true }).click(); await page.locator('.leave-confirmation').getByRole('button', { name: copy.corrReload, exact: true }).click()
  await expect(page.locator('#corr-phone')).toHaveValue('+251911111111'); draftConflict = false
  await page.locator('#corr-phone').fill('0912345678'); await page.locator('#file-identity').setInputFiles(proof); await expect(page.getByRole('link', { name: copy.regPreview })).toBeVisible()
  const keys: string[] = []; let submits = 0
  await page.route('**/corrections/resubmit', route => {
    keys.push(route.request().headers()['idempotency-key']!); submits++
    return route.fulfill({ status: submits === 1 ? 503 : 200, json: submits === 1 ? { code: 'UNAVAILABLE' } : { success: true, data: { id: value.application.id, status: 'PENDING', revision: 3, resubmittedAt: new Date().toISOString() } } })
  })
  await page.getByRole('button', { name: copy.corrReviewButton }).click(); await page.locator('#corr-confirmed').check(); await page.getByRole('button', { name: copy.corrSubmit }).click()
  await expect(page.getByRole('alert')).toContainText(copy.corrUnavailable); await expect(page.locator('.correction-review')).toContainText('0912345678')
  await page.getByRole('button', { name: copy.corrSubmit }).click(); await expect(page.getByRole('heading', { name: copy.corrSuccess })).toBeVisible()
  expect(keys).toHaveLength(2); expect(keys[0]).toBe(keys[1])
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('fgae.synthetic')))).toEqual([])
})
type CorrectionInputForTest = { fields: CorrectionContext['application']['fields']; documents: CorrectionContext['application']['documents'] }
