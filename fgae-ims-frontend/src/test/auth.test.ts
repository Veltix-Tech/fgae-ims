import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/locales/en/auth'
import { am } from '../i18n/locales/am/auth'
import { authService } from '../mocks/auth'
import { hasGrant, nextJourney } from '../permissions/session-policy'
import { mapIdentity } from '../services/adapters/auth-dto'
import { AuthClient } from '../services/http/auth-client'
import { roles } from '../services/contracts/auth'

const password = 'Demo-only-2026!'
const response = (data: unknown, status = 200) => new Response(JSON.stringify(status === 200 ? { success: true, data } : data), { status })
describe('AUTH-01 contract and policy', () => {
  it('has exactly matching non-empty translation keys', () => {
    expect(Object.keys(am).sort()).toEqual(Object.keys(en).sort())
    expect(Object.values(am).every(value => value.trim())).toBe(true)
  })
  it.each(roles)('authenticates %s and restores without storing a password', async role => {
    const email = `${role.toLowerCase().replaceAll('_', '.')}@example.test`
    const user = await authService.signIn({ email, password })
    expect(user.grants[0]?.role).toBe(role)
    expect(await authService.restore()).toEqual(user)
    expect(JSON.stringify(sessionStorage)).not.toContain(password)
    await authService.signOut()
    expect(await authService.restore()).toBeNull()
  })
  it('denies incorrect credentials and inactive accounts without saving a session', async () => {
    await expect(authService.signIn({ email: 'volunteer@example.test', password: 'wrong' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    await expect(authService.signIn({ email: 'inactive@example.test', password })).rejects.toMatchObject({ code: 'INACTIVE_ACCOUNT' })
    expect(await authService.restore()).toBeNull()
  })
  it('restricts pending and first-login identities before operational access', async () => {
    const pending = await authService.signIn({ email: 'pending@example.test', password })
    expect(nextJourney(pending)).toBe('application')
    expect(hasGrant(pending, 'VOLUNTEER', { kind: 'self', id: pending.id })).toBe(false)
    const first = await authService.signIn({ email: 'first.login@example.test', password })
    expect(nextJourney(first)).toBe('password-change')
    expect(hasGrant(first, 'VOLUNTEER', { kind: 'self', id: first.id })).toBe(false)
  })
  it('retains role/scope pairs and grants Super Admin global authority', async () => {
    const user = await authService.signIn({ email: 'branch.manager@example.test', password })
    user.grants.push({ role: 'HR', scope: { kind: 'branch', id: 'branch-b' } })
    expect(hasGrant(user, 'BRANCH_MANAGER', { kind: 'branch', id: 'branch-b' })).toBe(false)
    expect(hasGrant(user, 'HR', { kind: 'branch', id: 'branch-b' })).toBe(true)
    const admin = await authService.signIn({ email: 'super.admin@example.test', password })
    for (const role of roles) expect(hasGrant(admin, role, { kind: 'project', id: 'elsewhere' })).toBe(true)
  })
  it('maps legacy admin at the boundary and denies unknown roles', () => {
    const dto = { id: '1', display_name: 'Test', email: 'test@example.test', account_status: 'ACTIVE', must_change_password: false,
      role_grants: [{ role: 'SYSTEM_ADMIN', scope: { kind: 'global', id: '*' } }, { role: 'UNKNOWN', scope: { kind: 'global', id: '*' } }] }
    expect(mapIdentity(dto).grants).toEqual([{ role: 'SUPER_ADMIN', scope: { kind: 'global', id: '*' } }])
    expect(() => mapIdentity({ ...dto, must_change_password: undefined })).toThrow('INVALID_RESPONSE')
  })
  it('expires synthetic sessions and resets incompatible schema safely', async () => {
    sessionStorage.setItem('fgae.synthetic.auth.v1', JSON.stringify({ version: 1, email: 'volunteer@example.test', expiresAt: 1 }))
    await expect(authService.restore()).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
    sessionStorage.setItem('fgae.synthetic.auth.v1', '{bad')
    expect(await authService.restore()).toBeNull()
    sessionStorage.setItem('fgae.synthetic.auth.v1', JSON.stringify({ version: 9 }))
    expect(await authService.restore()).toBeNull()
  })
})
describe('live transport', () => {
  it('serializes concurrent refreshes', async () => {
    let release!: (value: Response) => void
    const fetcher = vi.fn<typeof fetch>().mockImplementation(() => new Promise(resolve => { release = resolve }))
    const client = new AuthClient('/api', fetcher)
    const first = client.refresh(); const second = client.refresh()
    release(response({ access_token: 'memory-only-token' }))
    await Promise.all([first, second])
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/auth/refresh')
    expect(fetcher.mock.calls[0]?.[1]?.credentials).toBe('include')
  })
  it('retries identity only once after 401 and renewed token', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response({}, 401)).mockResolvedValueOnce(response({ access_token: 'new-token' })).mockResolvedValueOnce(response({ id: '1' }))
    const client = new AuthClient('/api', fetcher)
    expect(await client.me()).toEqual({ id: '1' })
    expect(fetcher.mock.calls.map(call => call[0])).toEqual(['/api/auth/me', '/api/auth/refresh', '/api/auth/me'])
    expect(fetcher.mock.calls[2]?.[1]?.headers).toMatchObject({ Authorization: 'Bearer new-token' })
  })
  it('does not restore an access token from a stale refresh after clearing session', async () => {
    let release!: (value: Response) => void
    const fetcher = vi.fn<typeof fetch>().mockImplementation(() => new Promise(resolve => { release = resolve }))
    const client = new AuthClient('/api', fetcher)
    const pending = client.refresh(); client.clear(); release(response({ access_token: 'stale' }))
    await expect(pending).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
  })
  it('surfaces network, rate limiting, invalid response and final session loss', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValueOnce(new TypeError('network'))
      .mockResolvedValueOnce(response({}, 429)).mockResolvedValueOnce(response({ access_token: '' }))
      .mockResolvedValueOnce(response({}, 401)).mockResolvedValueOnce(response({ access_token: 'token' })).mockResolvedValueOnce(response({}, 401))
    const client = new AuthClient('/api', fetcher)
    await expect(client.login({ email: 'x', password: 'x' })).rejects.toMatchObject({ code: 'NETWORK' })
    await expect(client.login({ email: 'x', password: 'x' })).rejects.toMatchObject({ code: 'RATE_LIMITED' })
    await expect(client.login({ email: 'x', password: 'x' })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
    await expect(client.me()).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
    expect(fetcher).toHaveBeenCalledTimes(6)
  })
})
