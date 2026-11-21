import { describe, it, expect, vi, beforeEach } from 'vitest'
import { webcrypto } from 'node:crypto'
import { accessService, accessScopes } from '../mocks/user-access'
import { authService } from '../mocks/auth'
import { firstLoginService } from '../mocks/first-login'
import { directoryUsers } from '../mocks/portfolio'
import { accounts } from '../mocks/identities'
import { mapAccessContext, mapAccessResult, validateAccess, type AccessInput } from '../services/contracts/user-access'
const admin = accounts[0]!
const login = () => authService.signIn({ email: admin.email, password: 'Demo-only-2026!' })
const input = (extra: Partial<AccessInput> = {}): AccessInput => ({ name: 'Created member', email: 'created@example.test', version: 0, state: 'ACTIVE', grants: [{ role: 'MEMBER', scope: { kind: 'self', id: '@self' } }], reason: 'Approved account provisioning', reset: false, idempotencyKey: crypto.randomUUID(), ...extra })
beforeEach(() => vi.stubGlobal('crypto', webcrypto))
describe('administrative account access', () => {
  it('requires active global admin for read and write', async () => { await expect(accessService.load()).rejects.toMatchObject({ code: 'SESSION_EXPIRED' }); await authService.signIn({ email: 'hr@example.test', password: 'Demo-only-2026!' }); await expect(accessService.load()).rejects.toMatchObject({ code: 'FORBIDDEN' }); await expect(accessService.save(input())).rejects.toMatchObject({ code: 'FORBIDDEN' }) })
  it('creates a unique account and enforces first login without storing the handover secret', async () => {
    await login(); const saved = await accessService.save(input()); expect(saved.temporaryPassword).toBeTruthy(); expect(directoryUsers().find(row => row.id === saved.record.user.id)?.mustChangePassword).toBe(true)
    expect(localStorage.getItem('fgae.synthetic.credentials.v1')).not.toContain(saved.temporaryPassword!)
    const user = await authService.signIn({ email: saved.record.user.email, password: saved.temporaryPassword! }); expect(user.mustChangePassword).toBe(true); expect(user.grants[0]?.scope.id).toBe(user.id)
    await firstLoginService.complete({ currentPassword: saved.temporaryPassword!, password: 'Changed fictional phrase 2026!', confirmation: 'Changed fictional phrase 2026!', idempotencyKey: crypto.randomUUID() })
    expect((await authService.signIn({ email: user.email, password: 'Changed fictional phrase 2026!' })).mustChangePassword).toBe(false)
    expect(directoryUsers().find(row => row.id === user.id)?.mustChangePassword).toBe(false)
  })
  it('deduplicates uncertain retries but never replays temporary secrets', async () => { await login(); const request = input(); const first = await accessService.save(request); const second = await accessService.save(request); expect(second.replayed).toBe(true); expect(second.temporaryPassword).toBeNull(); expect(second.record).toEqual(first.record); expect(directoryUsers().filter(row => row.email === request.email)).toHaveLength(1); await expect(accessService.save({ ...request, reason: 'different' })).rejects.toMatchObject({ code: 'CONFLICT' }) })
  it('rejects duplicate emails, duplicate grants, missing reasons and forged scopes', async () => {
    await login(); await expect(accessService.save(input({ email: 'multi.role@example.test' }))).rejects.toMatchObject({ code: 'EMAIL_IN_USE' })
    const request = input(); expect(() => validateAccess({ ...request, state: 'PENDING', grants: [] }, accessScopes())).toThrow(); expect(() => validateAccess({ ...request, reason: '' }, accessScopes())).toThrow(); expect(() => validateAccess({ ...request, grants: [...request.grants, ...request.grants] }, accessScopes())).toThrow(); expect(() => validateAccess({ ...request, grants: [{ role: 'MEMBER', scope: { kind: 'global', id: '*' } }] }, accessScopes())).toThrow()
  })
  it('prevents removing the last ready global administrator', async () => { await login(); const context = await accessService.load(admin.id); const user = context.context.record!.user; await expect(accessService.save(input({ id: user.id, version: 1, name: user.name, email: user.email, state: 'SUSPENDED', grants: user.grants }))).rejects.toMatchObject({ code: 'LAST_ADMIN' }); expect((await authService.restore())?.id).toBe(admin.id) })
  it('records before/after changes, rejects stale writes and revokes target sessions', async () => {
    const target = await authService.signIn({ email: 'member@example.test', password: 'Demo-only-2026!' }); const session = sessionStorage.getItem('fgae.synthetic.auth.v1')!
    await login(); const { context } = await accessService.load(target.id); const user = context.record!.user
    const request = input({ id: user.id, version: 1, name: user.name, email: user.email, state: 'SUSPENDED', grants: user.grants })
    const saved = await accessService.save(request); expect(saved.record.version).toBe(2); expect(saved.record.history[0]?.before?.state).toBe('ACTIVE'); expect(saved.record.history[0]?.after.state).toBe('SUSPENDED')
    await expect(accessService.save({ ...request, idempotencyKey: crypto.randomUUID() })).rejects.toMatchObject({ code: 'CONFLICT' })
    sessionStorage.setItem('fgae.synthetic.auth.v1', session); await expect(authService.restore()).rejects.toMatchObject({ code: 'SESSION_EXPIRED' }); await expect(authService.signIn({ email: user.email, password: 'Demo-only-2026!' })).rejects.toBeTruthy()
  })
  it('replacement credentials work after an earlier password change and revoke the prior password', async () => {
    await login(); const first = await accessService.save(input()); await authService.signIn({ email: first.record.user.email, password: first.temporaryPassword! }); await firstLoginService.complete({ currentPassword: first.temporaryPassword!, password: 'Changed fictional phrase 2026!', confirmation: 'Changed fictional phrase 2026!', idempotencyKey: crypto.randomUUID() })
    await login(); const { context } = await accessService.load(first.record.user.id); const user = context.record!.user
    const replacement = await accessService.save(input({ id: user.id, version: 1, name: user.name, email: user.email, grants: user.grants, reset: true }))
    await expect(authService.signIn({ email: user.email, password: 'Changed fictional phrase 2026!' })).rejects.toBeTruthy(); expect((await authService.signIn({ email: user.email, password: replacement.temporaryPassword! })).mustChangePassword).toBe(true)
    await firstLoginService.complete({ currentPassword: replacement.temporaryPassword!, password: 'Second changed phrase 2026!', confirmation: 'Second changed phrase 2026!', idempotencyKey: crypto.randomUUID() }); expect((await authService.signIn({ email: user.email, password: 'Second changed phrase 2026!' })).mustChangePassword).toBe(false)
  })
  it('validates live ownership, record identity, malformed history and secret-free updates', async () => {
    await login(); const { context } = await accessService.load(admin.id)
    expect(() => mapAccessContext({ ...context, ownerId: 'other' }, admin, admin.id)).toThrow(); expect(() => mapAccessContext(context, admin, 'other')).toThrow(); expect(() => mapAccessContext({ ...context, record: { ...context.record, history: [{}] } }, admin, admin.id)).toThrow()
    const request = input({ id: admin.id }); expect(() => mapAccessResult({ ownerId: admin.id, record: context.record, temporaryPassword: 'should-not-be-here', replayed: false }, admin, request)).toThrow()
  })
})
