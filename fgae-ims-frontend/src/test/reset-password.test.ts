import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { resetPasswordService as mockService } from '../mocks/reset-password'
import { resetPasswordService as liveService } from '../services/adapters/live-reset-password'
import { recoveryService } from '../mocks/recovery'
import { authService } from '../mocks/auth'
import { roles } from '../services/contracts/auth'
import { validNewPassword } from '../services/contracts/reset-password'

beforeAll(() => { vi.stubGlobal('crypto', webcrypto) })
afterAll(() => { vi.unstubAllGlobals() })
const password = 'A different fictional phrase 2026'
const token = 'demo-reset-volunteer'
const input = { token, password, confirmation: password, idempotencyKey: 'completion-a' }

describe('reset completion', () => {
  it.each([...roles.map(role => `${role.toLowerCase().replaceAll('_', '.')}@example.test`), 'pending@example.test', 'first.login@example.test', 'multi.role@example.test'])('resets %s without changing role grants or review status', async email => {
    const before = await authService.signIn({ email, password: 'Demo-only-2026!' })
    await recoveryService.request({ email, locale: 'en', idempotencyKey: 'issue-a' })
    const link = 'synthetic-reset-issue-a'
    await mockService.validate(link)
    await mockService.complete({ ...input, token: link })
    await expect(authService.restore()).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
    await expect(authService.signIn({ email, password: 'Demo-only-2026!' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    const after = await authService.signIn({ email, password })
    expect(after.grants).toEqual(before.grants)
    expect(after.accountState).toBe(before.accountState)
    expect(after.mustChangePassword).toBe(false)
    expect(JSON.stringify(localStorage)).not.toContain(password)
    expect(JSON.stringify(sessionStorage)).not.toContain(password)
    await expect(mockService.validate(link)).rejects.toMatchObject({ code: 'USED_LINK' })
  })
  it('handles missing, invalid, expired and used links', async () => {
    await expect(mockService.validate('')).rejects.toMatchObject({ code: 'INVALID_LINK' })
    await expect(mockService.validate('not-a-token')).rejects.toMatchObject({ code: 'INVALID_LINK' })
    await expect(mockService.validate('demo-reset-expired')).rejects.toMatchObject({ code: 'EXPIRED_LINK' })
    await expect(mockService.validate('demo-reset-used')).rejects.toMatchObject({ code: 'USED_LINK' })
  })
  it('validates confirmation and current password before consuming the token', async () => {
    await mockService.validate(token)
    await expect(mockService.complete({ ...input, password: 'short' })).rejects.toMatchObject({ code: 'PASSWORD_REJECTED' })
    await expect(mockService.complete({ ...input, confirmation: 'mismatch' })).rejects.toMatchObject({ code: 'CONFIRMATION_MISMATCH' })
    await expect(mockService.complete({ ...input, password: 'Demo-only-2026!', confirmation: 'Demo-only-2026!' })).rejects.toMatchObject({ code: 'SAME_PASSWORD' })
    expect(await mockService.validate(token)).toHaveProperty('expiresAt')
    expect(validNewPassword('አዲስ የሙከራ የይለፍ ቃል')).toBe(true)
    expect(validNewPassword(' '.repeat(12))).toBe(false)
    expect(validNewPassword('a'.repeat(129))).toBe(false)
  })
  it('makes duplicate completion idempotent, prevents conflicting decisions and invalidates sibling links', async () => {
    await mockService.validate(token)
    await recoveryService.request({ email: 'volunteer@example.test', locale: 'en', idempotencyKey: 'sibling' })
    const results = await Promise.allSettled([
      mockService.complete(input),
      mockService.complete({ ...input, idempotencyKey: 'competing' }),
    ])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    await expect(mockService.complete(input)).resolves.toBeUndefined()
    const state = JSON.parse(localStorage.getItem('fgae.synthetic.credentials.v1')!)
    expect(state.credentials['volunteer@example.test'].revision).toBe(1)
    await expect(mockService.validate('synthetic-reset-sibling')).rejects.toMatchObject({ code: 'USED_LINK' })
    await expect(mockService.complete({ ...input, password: 'Another changed phrase', confirmation: 'Another changed phrase' })).rejects.toMatchObject({ code: 'USED_LINK' })
  })
  it('handles expiry after validation and cancellation without changing credentials', async () => {
    const link = await mockService.validate(token)
    const clock = vi.spyOn(Date, 'now').mockReturnValue(link.expiresAt + 1)
    await expect(mockService.complete(input)).rejects.toMatchObject({ code: 'EXPIRED_LINK' })
    clock.mockRestore()
    const controller = new AbortController(); controller.abort()
    await expect(mockService.complete(input, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect((await authService.signIn({ email: 'volunteer@example.test', password: 'Demo-only-2026!' })).accountState).toBe('ACTIVE')
  })
  it('does not issue a link for inactive or unknown addresses', async () => {
    await recoveryService.request({ email: 'inactive@example.test', locale: 'en', idempotencyKey: 'inactive' })
    await expect(mockService.validate('synthetic-reset-inactive')).rejects.toMatchObject({ code: 'INVALID_LINK' })
    expect(localStorage.getItem('fgae.synthetic.credentials.v1')).toBeNull()
  })
})

describe('proposed live reset contracts', () => {
  it('posts token in body, omits cookies, validates response and maps safe errors', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch')
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { valid: true, expires_at: new Date(Date.now() + 60_000).toISOString() } })))
    expect(await liveService.validate('live-test-token')).toHaveProperty('expiresAt')
    expect(fetcher).toHaveBeenCalledWith('/auth/reset-password/validate', expect.objectContaining({ method: 'POST', credentials: 'omit', body: JSON.stringify({ token: 'live-test-token' }) }))
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { completed: true } })))
    await liveService.complete(input)
    expect(fetcher).toHaveBeenLastCalledWith('/auth/reset-password', expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': 'completion-a' }) }))
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ code: 'EXPIRED_LINK' }), { status: 410 }))
    await expect(liveService.validate('expired')).rejects.toMatchObject({ code: 'EXPIRED_LINK' })
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { completed: false } })))
    await expect(liveService.complete(input)).rejects.toMatchObject({ code: 'UNAVAILABLE' })
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ code: 'PASSWORD_REJECTED' }), { status: 422 }))
    await expect(liveService.complete(input)).rejects.toMatchObject({ code: 'PASSWORD_REJECTED' })
    fetcher.mockRejectedValueOnce(new TypeError('offline'))
    await expect(liveService.validate('offline')).rejects.toMatchObject({ code: 'NETWORK' })
    expect(localStorage.length).toBe(0)
  })
})
