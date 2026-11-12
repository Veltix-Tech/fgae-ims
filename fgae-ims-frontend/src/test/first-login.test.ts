import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { authService } from '../mocks/auth'
import { firstLoginService } from '../mocks/first-login'
import { accounts } from '../mocks/identities'
import { recoveryService } from '../mocks/recovery'
import { resetPasswordService } from '../mocks/reset-password'
import { roles } from '../services/contracts/auth'
import { hasGrant } from '../permissions/session-policy'
import { AuthClient } from '../services/http/auth-client'

beforeAll(() => vi.stubGlobal('crypto', webcrypto))
afterAll(() => vi.unstubAllGlobals())
const currentPassword = 'Demo-only-2026!'
const password = 'My new fictional phrase 2026'
const input = { currentPassword, password, confirmation: password, idempotencyKey: 'first-attempt' }
const signIn = (email = 'first.login@example.test') => authService.signIn({ email, password: currentPassword })
const response = (data: unknown, status = 200) => new Response(JSON.stringify(status === 200 ? { success: true, data } : data), { status })

describe('first-login restricted credential replacement', () => {
  it.each(roles)('preserves %s grants and invalidates the temporary credential/session', async role => {
    const email = `first.${role.toLowerCase().replaceAll('_', '.')}@example.test`
    const before = await signIn(email)
    expect(before.mustChangePassword).toBe(true)
    expect(hasGrant(before, role, before.grants[0]!.scope)).toBe(false)
    await firstLoginService.complete(input)
    await expect(authService.restore()).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
    await expect(signIn(email)).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    const after = await authService.signIn({ email, password })
    expect(after.grants).toEqual(before.grants)
    expect(after.accountState).toBe(before.accountState)
    expect(after.mustChangePassword).toBe(false)
    expect(await authService.restore()).toEqual(after)
    expect(JSON.stringify(localStorage)).not.toContain(password)
    expect(JSON.stringify(localStorage)).not.toContain(currentPassword)
  })
  it('rejects unauthenticated, expired and ordinary sessions', async () => {
    await expect(firstLoginService.complete(input)).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
    await signIn('volunteer@example.test')
    await expect(firstLoginService.complete(input)).rejects.toMatchObject({ code: 'NOT_REQUIRED' })
    await signIn()
    const state = JSON.parse(sessionStorage.getItem('fgae.synthetic.auth.v1')!)
    sessionStorage.setItem('fgae.synthetic.auth.v1', JSON.stringify({ ...state, expiresAt: 0 }))
    await expect(firstLoginService.complete(input)).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
    expect(localStorage.getItem('fgae.synthetic.credentials.v1')).toBeNull()
  })
  it('retains restriction on wrong, same, short or mismatched credentials', async () => {
    await signIn()
    await expect(firstLoginService.complete({ ...input, currentPassword: 'wrong' })).rejects.toMatchObject({ code: 'WRONG_PASSWORD' })
    await expect(firstLoginService.complete({ ...input, password: currentPassword, confirmation: currentPassword })).rejects.toMatchObject({ code: 'SAME_PASSWORD' })
    await expect(firstLoginService.complete({ ...input, password: 'short' })).rejects.toMatchObject({ code: 'PASSWORD_REJECTED' })
    await expect(firstLoginService.complete({ ...input, confirmation: 'other' })).rejects.toMatchObject({ code: 'CONFIRMATION_MISMATCH' })
    expect((await authService.restore())?.mustChangePassword).toBe(true)
  })
  it('serializes conflicting changes, replays only identical intent and consumes recovery links', async () => {
    await signIn()
    await recoveryService.request({ email: 'first.login@example.test', locale: 'en', idempotencyKey: 'sibling' })
    const results = await Promise.allSettled([firstLoginService.complete(input), firstLoginService.complete({ ...input, idempotencyKey: 'competing' })])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    await expect(firstLoginService.complete(input)).resolves.toBeUndefined()
    await expect(firstLoginService.complete({ ...input, currentPassword: 'changed' })).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
    await expect(resetPasswordService.validate('synthetic-reset-sibling')).rejects.toMatchObject({ code: 'USED_LINK' })
  })
  it('leaves pending review and its grants unchanged', async () => {
    const account = accounts.find(item => item.email === 'first.login@example.test')!
    const original = account.accountState
    try {
      account.accountState = 'PENDING'
      const before = await signIn()
      await firstLoginService.complete(input)
      const after = await authService.signIn({ email: account.email, password })
      expect(after.accountState).toBe('PENDING')
      expect(after.grants).toEqual(before.grants)
      expect(hasGrant(after, 'VOLUNTEER', after.grants[0]!.scope)).toBe(false)
    } finally { account.accountState = original }
  })
  it('does not mutate after cancellation or offline failure', async () => {
    await signIn()
    const controller = new AbortController(); controller.abort()
    await expect(firstLoginService.complete(input, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    await expect(firstLoginService.complete(input)).rejects.toMatchObject({ code: 'NETWORK' })
    online.mockRestore()
    expect((await authService.restore())?.mustChangePassword).toBe(true)
  })
})
describe('proposed authenticated first-login API', () => {
  it('shares bearer/cookie authentication, retries with same key, maps policy errors and clears token on success', async () => {
    const fetcher = vi.fn<typeof fetch>()
    const client = new AuthClient('', fetcher)
    fetcher.mockResolvedValueOnce(response({ access_token: 'temporary-access' }))
    await client.login({ email: 'fictional', password: currentPassword })
    fetcher.mockResolvedValueOnce(response({ code: 'WRONG_PASSWORD' }, 422))
    await expect(client.replaceTemporaryPassword(input)).rejects.toMatchObject({ code: 'WRONG_PASSWORD' })
    expect(fetcher).toHaveBeenLastCalledWith('/auth/first-login/password', expect.objectContaining({ credentials: 'include', headers: expect.objectContaining({ Authorization: 'Bearer temporary-access', 'Idempotency-Key': input.idempotencyKey }), body: JSON.stringify({ current_password: currentPassword, password, password_confirmation: password }) }))
    fetcher.mockResolvedValueOnce(response({}, 401)).mockResolvedValueOnce(response({ access_token: 'renewed' })).mockResolvedValueOnce(response({ completed: true }))
    await client.replaceTemporaryPassword(input)
    expect(fetcher).toHaveBeenLastCalledWith('/auth/first-login/password', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer renewed', 'Idempotency-Key': input.idempotencyKey }) }))
    fetcher.mockResolvedValueOnce(response({}))
    await client.me()
    expect(fetcher.mock.calls.at(-1)?.[1]?.headers).not.toHaveProperty('Authorization')
  })
  it('rejects malformed success, non-JSON throttling, network failure and stale completion', async () => {
    const fetcher = vi.fn<typeof fetch>()
    const client = new AuthClient('', fetcher)
    fetcher.mockResolvedValueOnce(response({ completed: false }))
    await expect(client.replaceTemporaryPassword(input)).rejects.toMatchObject({ code: 'UNAVAILABLE' })
    fetcher.mockResolvedValueOnce(new Response('', { status: 429 }))
    await expect(client.replaceTemporaryPassword(input)).rejects.toMatchObject({ code: 'RATE_LIMITED' })
    fetcher.mockRejectedValueOnce(new TypeError('offline'))
    await expect(client.replaceTemporaryPassword(input)).rejects.toMatchObject({ code: 'NETWORK' })
    let release!: (value: Response) => void
    fetcher.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
    const pending = client.replaceTemporaryPassword(input)
    client.clear(); release(response({ completed: true }))
    await expect(pending).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
  })
})
