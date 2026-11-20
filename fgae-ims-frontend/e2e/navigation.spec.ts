import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { en } from '../src/i18n/locales/en/auth'
import { am } from '../src/i18n/locales/am/auth'
for (const locale of ['en', 'am'] as const) test(`workspace navigation ${locale} desktop and mobile`, async ({ page }) => {
  const copy = locale === 'en' ? en : am
  await page.addInitScript(locale => localStorage.setItem('fgae.locale', locale), locale)
  await page.goto('/sign-in'); await page.locator('#email').fill('super.admin@example.test'); await page.locator('#password').fill('Demo-only-2026!'); await page.getByRole('button', { name: copy.signIn, exact: true }).click(); await expect(page.locator('.workspace-launcher')).toBeVisible()
  for (const width of [1920, 390]) {
    await page.setViewportSize({ width, height: 1080 })
    await page.evaluate(async () => { await document.fonts.ready; document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).forEach(a => a.finish()) })
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `docs/screenshots/launcher-${locale}-${width}.png`, fullPage: true, animations: 'disabled' })
  }
  await page.getByRole('link', { name: copy.usersLink, exact: true }).click(); await expect(page.locator('#directory-search')).toBeVisible()
  await page.setViewportSize({ width: 1920, height: 1080 }); await expect(page.locator('.workspace-sidebar')).toBeVisible()
  expect((await page.locator('main').boundingBox())!.width).toBeGreaterThan(1700)
  const nav = page.getByRole('navigation', { name: copy.navMain, exact: true })
  await expect(nav.getByRole('link', { name: `${copy.navGoTo}: ${copy.usersLink}` })).toHaveAttribute('aria-current', 'page')
  await page.screenshot({ path: `docs/screenshots/navigation-${locale}-1920.png`, fullPage: true, animations: 'disabled' })
  await nav.getByRole('button', { name: copy.acctLink, exact: true }).click(); await nav.getByRole('link', { name: `${copy.navGoTo}: ${copy.acctLink}`, exact: true }).click(); await expect(page.locator('#acct-name')).toBeVisible(); await expect(page.locator('.workspace-sidebar')).toBeVisible(); await page.getByRole('navigation', { name: copy.navMain, exact: true }).getByRole('link', { name: `${copy.navGoTo}: ${copy.projectLink}` }).click(); await expect(page.locator('.portfolio-project')).toHaveCount(2)
  await page.setViewportSize({ width: 390, height: 900 }); await page.getByRole('button', { name: copy.navMain, exact: true }).click()
  await page.getByRole('navigation', { name: copy.navMain, exact: true }).getByRole('link', { name: `${copy.navGoTo}: ${copy.usersLink}` }).click(); await expect(page.locator('#directory-search')).toBeVisible()
  await page.getByRole('button', { name: copy.portNext, exact: true }).scrollIntoViewIfNeeded()
  await page.evaluate(() => { (window as Window & { paginationMarker?: boolean }).paginationMarker = true; return scrollY })
  await page.getByRole('button', { name: copy.portNext, exact: true }).click(); await expect(page.locator('.directory-pages')).toContainText('2')
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(300)
  expect(await page.evaluate(() => (window as Window & { paginationMarker?: boolean }).paginationMarker)).toBe(true)
  await page.getByRole('button', { name: copy.portPrevious, exact: true }).click(); await expect(page.locator('.directory-pages')).toContainText('1')
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(300)
  await page.locator('#directory-role').focus(); await page.keyboard.press('Enter'); await expect(page.locator('#directory-role-options')).toBeVisible(); await page.keyboard.press('Escape'); await expect(page.locator('#directory-role')).toBeFocused(); await expect(page.locator('#directory-role-options')).toBeHidden()
  await page.locator('#directory-role').click(); await page.locator('#directory-role-options').getByRole('button', { name: copy.MEMBER, exact: true }).click(); await expect(page.locator('.directory-users > li')).toHaveCount(3)
  await page.getByRole('button', { name: copy.signOut, exact: true }).click(); await expect(page.locator('.workspace-sidebar')).toBeHidden()
  await page.goto('/sign-in'); await page.locator('#email').fill('member@example.test'); await page.locator('#password').fill('Demo-only-2026!'); await page.getByRole('button', { name: copy.signIn, exact: true }).click(); await page.getByRole('link', { name: copy.memberLink, exact: true }).click()
  await page.getByRole('button', { name: copy.navMain, exact: true }).click(); await expect(page.locator('.mobile-navigation-sheet').getByRole('link', { name: `${copy.navGoTo}: ${copy.usersLink}` })).toHaveCount(0)
})


for (const locale of ['en', 'am'] as const) test(`mobile navigation sheet ${locale} reachable while scrolled`, async ({ page }) => {
  const copy = locale === 'en' ? en : am
  await page.addInitScript(locale => localStorage.setItem('fgae.locale', locale), locale)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/sign-in'); await page.locator('#email').fill('super.admin@example.test'); await page.locator('#password').fill('Demo-only-2026!'); await page.getByRole('button', { name: copy.signIn, exact: true }).click(); await page.getByRole('link', { name: copy.usersLink, exact: true }).click(); await expect(page.locator('#directory-search')).toBeVisible()
  for (const width of [390, 768, 1024]) {
    await page.setViewportSize({ width, height: 844 })
    await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'instant' }))
    const before = await page.evaluate(() => scrollY)
    const trigger = page.getByRole('button', { name: copy.navMain, exact: true })
    const box = (await trigger.boundingBox())!
    expect(box.y).toBeGreaterThan(0); expect(box.y + box.height).toBeLessThanOrEqual(844)
    await trigger.click(); const sheet = page.getByRole('dialog', { name: copy.navMain, exact: true }); await expect(sheet).toBeVisible()
    await page.evaluate(async () => { await document.fonts.ready; document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).forEach(a => a.finish()) })
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `docs/screenshots/mobile-sheet-${locale}-${width}.png`, fullPage: false, animations: 'disabled' })
    await page.keyboard.press('Escape'); await expect(sheet).toBeHidden(); await expect(trigger).toBeFocused()
    expect(Math.abs(await page.evaluate(() => scrollY) - before)).toBeLessThan(2)
    await trigger.click(); await page.getByRole('button', { name: copy.navClose, exact: true }).click(); await expect(sheet).toBeHidden()
  }
  await page.getByRole('button', { name: copy.navMain, exact: true }).click()
  await page.getByRole('dialog').getByRole('link', { name: `${copy.navGoTo}: ${copy.projectLink}` }).click(); await expect(page.locator('.portfolio-project')).toHaveCount(2)
  await page.getByRole('button', { name: copy.navMain, exact: true }).click(); await page.setViewportSize({ width: 1440, height: 900 }); await expect(page.locator('.workspace-sidebar')).toBeVisible(); await expect(page.getByRole('dialog')).toHaveCount(0); expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
})
