import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { en } from '../src/i18n/locales/en/auth'
import { am } from '../src/i18n/locales/am/auth'
async function login(page: Page, copy: typeof am = en, email = 'super.admin@example.test', password = 'Demo-only-2026!') {
  await page.goto('/sign-in'); await page.locator('#email').fill(email); await page.locator('#password').fill(password); await page.getByRole('button', { name: copy.signIn, exact: true }).click(); await expect(page.getByRole('heading', { name: copy.signedIn })).toBeVisible()
}
async function choose(page: Page, id: string, value: string) { await page.locator(`#${id}`).click(); await page.locator(`#${id}-options [data-option-value="${value}"]`).click() }
async function responsive(page: Page, name: string) {
  for (const width of [360,390,768,1024,1440]) {
    await page.setViewportSize({ width, height: 900 }); await page.evaluate(async () => { await document.fonts.ready; document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).forEach(a => a.finish()) })
    expect((await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `docs/screenshots/${name}-${width}.png`, fullPage: true, animations: 'disabled' })
  }
}
for (const locale of ['en','am'] as const) test(`access ${locale} create detail edit five widths and first login`, async ({ page }) => {
  const copy = locale === 'en' ? en : am; await page.addInitScript(locale => localStorage.setItem('fgae.locale', locale), locale)
  await login(page, copy); await page.getByRole('link', { name: copy.usersLink, exact: true }).click(); await page.getByRole('link', { name: copy.uaCreate, exact: true }).click(); await expect(page.locator('#access-name')).toBeVisible()
  await page.locator('#access-name').fill('New Account'); await page.locator('#access-email').fill('new.account@example.test'); await page.getByRole('button', { name: copy.uaAdd }).click(); await choose(page,'access-role-0','MEMBER'); await page.locator('#access-reason').fill('Approved new member account')
  await responsive(page, `access-create-${locale}`)
  await page.getByRole('button', { name: copy.uaReview, exact: true }).click(); await page.getByRole('checkbox').check(); await page.getByRole('button', { name: copy.uaSave, exact: true }).click(); await expect(page.locator('#handover-password')).toBeVisible(); const password = await page.locator('#handover-password').inputValue()
  expect(password.length).toBeGreaterThan(12); expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(password)
  await expect(page.locator('#handover-password')).toHaveAttribute('type','password'); await page.getByRole('button', { name: copy.uaReveal }).click(); await expect(page.locator('#handover-password')).toHaveAttribute('type','text')
  await page.getByRole('link', { name: copy.uaView }).click(); const details = page.url(); await expect(page.locator('.access-audit')).toHaveCount(1); await expect(page.locator('main')).not.toContainText(password); await responsive(page, `access-detail-${locale}`)
  await page.getByRole('link', { name: copy.uaEdit, exact: true }).click(); await expect(page.locator('#access-name')).toHaveAttribute('readonly',''); await page.getByRole('button', { name: copy.uaAdd }).click(); await page.locator('#access-reason').fill('Allow own volunteer workspace as well'); await responsive(page, `access-edit-${locale}`)
  await page.getByRole('button', { name: copy.uaReview, exact: true }).click(); await page.getByRole('checkbox').check(); await page.getByRole('button', { name: copy.uaSave, exact: true }).click(); await expect(page.locator('#access-heading')).toHaveText(copy.uaSaved); await page.getByRole('link', { name: copy.uaView }).click(); await expect(page.locator('.access-audit')).toHaveCount(2)
  await page.evaluate(() => sessionStorage.removeItem('fgae.synthetic.auth.v1')); await login(page, copy, 'new.account@example.test', password); await page.getByRole('link', { name: copy.firstContinue }).click(); await page.locator('#current-password').fill(password); await page.locator('#new-password').fill('New member fictional phrase'); await page.locator('#confirm-password').fill('New member fictional phrase'); await page.getByRole('button', { name: copy.firstSubmit, exact: true }).click(); await expect(page.locator('main')).toContainText(copy.resetSuccessHeading)
  await login(page, copy); await page.goto(details); await expect(page.locator('main')).toContainText(copy.uaReady)
})
test('access denial, validation, last admin, dirty navigation and expired session', async ({ page }) => {
  await page.goto('/users/new'); await expect(page.getByRole('alert')).toContainText(en.homeSignInNote)
  await login(page,en,'hr@example.test'); await page.goto('/users/new'); await expect(page.getByRole('alert')).toContainText(en.mgrDeniedNote)
  await page.evaluate(() => sessionStorage.clear()); await login(page); await page.goto('/users/fictional-person-0/edit'); await page.locator('#access-reason').fill('Attempt to suspend only ready admin'); await choose(page,'access-state','SUSPENDED'); await page.getByRole('button',{name:en.uaReview,exact:true}).click(); await page.getByRole('checkbox').check(); await page.getByRole('button',{name:en.uaSave,exact:true}).click(); await expect(page.getByRole('alert')).toContainText(en.uaLastAdmin)
  page.once('dialog', dialog => dialog.dismiss()); await page.getByRole('link',{name:en.uaBack}).click(); await expect(page).toHaveURL(/\/edit$/)
  await page.evaluate(() => { const bus = new BroadcastChannel('fgae.auth'); bus.postMessage('signed-out'); bus.close() }); await expect(page.locator('#access-name')).toHaveCount(0); await expect(page.getByRole('alert')).toContainText(en.homeSignInNote)
})

test('access live create conflicts, retries and malformed ownership never fall back to mocks', async ({ page }) => {
  const identity = { id: 'owner', name: 'Live administrator', email: 'admin@organization.org', accountState: 'ACTIVE', mustChangePassword: false, grants: [{ role: 'SUPER_ADMIN', scope: { kind: 'global', id: '*' } }] }
  const context = { ownerId: identity.id, record: null, scopes: [{ kind: 'self', id: '@self', name: 'Own records', roles: ['VOLUNTEER','MEMBER'] }] }
  await page.route('**/auth/refresh', route => route.fulfill({ json: { success: true, data: { access_token: 'live-token' } } }))
  await page.route('**/auth/me', route => route.fulfill({ json: { success: true, data: { id: identity.id, display_name: identity.name, email: identity.email, account_status: identity.accountState, must_change_password: false, role_grants: identity.grants } } }))
  let ownerMismatch = true
  await page.route('**/users/create-context', route => route.fulfill({ json: { success: true, data: { ...context, ownerId: ownerMismatch ? 'different-owner' : identity.id } } }))
  await page.goto('http://127.0.0.1:5174/users/new'); await expect(page.getByRole('alert')).toContainText(en.mgrUnavailable); await expect(page.locator('#access-name')).toHaveCount(0)
  ownerMismatch = false; await page.getByRole('button', { name: en.appRetry, exact: true }).click(); await page.locator('#access-name').fill('Live member'); await page.locator('#access-email').fill('member@organization.org'); await page.getByRole('button', { name: en.uaAdd }).click(); await page.locator('#access-reason').fill('Provision authorized account'); await page.getByRole('button', { name: en.uaReview, exact: true }).click(); await page.getByRole('checkbox').check()
  let attempts = 0; const keys: string[] = []
  await page.route('**/users', async route => {
    if (route.request().method() !== 'POST') return route.continue()
    attempts++; keys.push(route.request().headers()['idempotency-key']!); expect(route.request().headers().authorization).toBe('Bearer live-token')
    if (attempts === 1) return route.fulfill({ status: 503, json: { code: 'UNAVAILABLE' } })
    return route.fulfill({ status: 409, json: { code: 'EMAIL_IN_USE' } })
  })
  await page.getByRole('button', { name: en.uaSave, exact: true }).click(); await expect(page.getByRole('alert')).toContainText(en.mgrUnavailable); await page.getByRole('button', { name: en.uaSave, exact: true }).click(); await expect(page.getByRole('alert')).toContainText(en.uaEmailUsed); expect(keys[0]).toBeTruthy(); expect(keys[1]).toBe(keys[0]); await expect(page.locator('#handover-password')).toHaveCount(0)
  expect(await page.evaluate(() => Object.keys(localStorage).some(key => key.startsWith('fgae.synthetic')))).toBe(false)
})
