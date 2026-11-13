import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { File as NodeFile } from 'node:buffer'
import { accountService } from '../mocks/account'
import { authService } from '../mocks/auth'
import { accounts } from '../mocks/identities'
import { canManageAccount, mapAccountProfile, type AccountInput } from '../services/contracts/account'
import { AuthClient } from '../services/http/auth-client'
const files = vi.hoisted(() => new Map<string, unknown>())
vi.mock('../mocks/registration-store', () => ({ readRegistrationItem: vi.fn(async (key: string) => files.get(key) ?? null), writeRegistrationItem: vi.fn(async (key: string, value: unknown, signal?: AbortSignal) => { signal?.throwIfAborted(); files.set(key, value) }), updateDraft: vi.fn() }))
beforeAll(() => { vi.stubGlobal('crypto', webcrypto); vi.stubGlobal('File', NodeFile) }); afterAll(() => vi.unstubAllGlobals()); beforeEach(() => files.clear())
const initial = 'Demo-only-2026!'; const replacement = 'A new fictional account phrase'
const password = { currentPassword: initial, password: replacement, confirmation: replacement, idempotencyKey: 'one-change' }
async function login(email = 'volunteer@example.test') { return authService.signIn({ email, password: initial }) }
describe('account ownership and profile persistence', () => {
  it('gates temporary/unknown identities, permits all ten roles and pending applicants', async () => {
    await expect(accountService.load()).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
    for (const identity of accounts) {
      expect(canManageAccount(identity)).toBe(!identity.mustChangePassword)
      await login(identity.email)
      if (identity.mustChangePassword) await expect(accountService.load()).rejects.toMatchObject({ code: 'FORBIDDEN' })
      else expect((await accountService.load()).profile.ownerId).toBe(identity.id)
    }
    expect(canManageAccount({ ...accounts[0]!, accountState: 'ACTIVE', grants: [] })).toBe(false)
  })
  it('saves permitted name/contact/language and restores identity name without changing grants', async () => {
    const original = await login(); const snapshot = await accountService.load()
    const result = await accountService.save({ ...snapshot.profile, name: 'Updated Volunteer', phone: '0912345678', locale: 'am' })
    expect(result).toMatchObject({ name: 'Updated Volunteer', phone: '+251912345678', locale: 'am', version: 2 })
    const identity = await authService.restore(); expect(identity?.name).toBe(result.name); expect(identity?.grants).toEqual(original.grants)
    expect((await accountService.load()).profile).toEqual(result)
  })
  it('rejects another owner, invalid profile values and concurrent stale versions', async () => {
    await login(); const { profile } = await accountService.load()
    await expect(accountService.save({ ...profile, ownerId: 'other' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(accountService.save({ ...profile, name: 'x', phone: '123' })).rejects.toMatchObject({ code: 'VALIDATION' })
    const results = await Promise.allSettled([accountService.save({ ...profile, name: 'First update' }), accountService.save({ ...profile, name: 'Second update' })])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.find(result => result.status === 'rejected')).toMatchObject({ reason: { code: 'CONFLICT' } })
  })
  it('validates photo bytes/type/ownership, persists replacement and removal', async () => {
    await login(); const { profile } = await accountService.load(); const signal = new AbortController().signal
    const png = new NodeFile([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0])], 'photo.png', { type: 'image/png' }) as unknown as File
    const photo = await accountService.upload(png, 'photo', signal, () => {})
    expect((await accountService.preview(photo.id, signal)).size).toBe(png.size)
    const saved = await accountService.save({ ...profile, photo }); expect(saved.photo).toEqual(photo)
    const removed = await accountService.save({ ...saved, photo: null }); expect(removed.photo).toBeNull()
    await expect(accountService.upload(new NodeFile(['not png'], 'bad.png', { type: 'image/png' }) as unknown as File, 'photo', signal, () => {})).rejects.toMatchObject({ code: 'FILE_TYPE' })
    await login('hr@example.test'); await expect(accountService.preview(photo.id, signal)).rejects.toMatchObject({ code: 'DOCUMENT_MISSING' })
    const other = await accountService.load(); await expect(accountService.save({ ...other.profile, photo })).rejects.toMatchObject({ code: 'DOCUMENT_MISSING' })
  })
  it('fails closed for malformed or wrong-owner live profiles', async () => {
    await login(); const { profile } = await accountService.load()
    for (const change of [{ version: 0 }, { ownerId: 'another' }, { locale: 'unknown' }, { editableFields: ['email'] }, { photo: { id: 'x', mime: 'image/svg+xml' } }]) expect(() => mapAccountProfile({ ...profile, ...change }, profile.ownerId)).toThrow()
  })
})
describe('ordinary password changes', () => {
  it('rejects wrong current, reused password and mismatched confirmation without mutation', async () => {
    await login()
    for (const [change, code] of [[{ currentPassword: 'wrong' }, 'WRONG_PASSWORD'], [{ password: initial, confirmation: initial }, 'SAME_PASSWORD'], [{ confirmation: 'different' }, 'CONFIRMATION_MISMATCH']] as const) await expect(accountService.password({ ...password, ...change })).rejects.toMatchObject({ code })
    await expect(login()).resolves.toHaveProperty('id')
  })
  it('replays an identical intent once, ends old sessions, preserves roles and stores no plaintext', async () => {
    const identity = await login()
    await accountService.password(password); await accountService.password(password)
    await expect(authService.restore()).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
    await expect(login()).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    expect((await authService.signIn({ email: identity.email, password: replacement })).grants).toEqual(identity.grants)
    expect(localStorage.getItem('fgae.synthetic.credentials.v1')).not.toContain(replacement)
    expect(localStorage.getItem('fgae.synthetic.credentials.v1')).not.toContain(initial)
  })
  it('never grants pending access and rejects aborted password changes', async () => {
    await login('pending@example.test'); const abort = new AbortController(); abort.abort()
    await expect(accountService.password(password, abort.signal)).rejects.toMatchObject({ name: 'AbortError' })
    await accountService.password(password)
    const identity = await authService.signIn({ email: 'pending@example.test', password: replacement }); expect(identity.accountState).toBe('PENDING'); expect(identity.grants).toEqual([])
  })
})
describe('account live transport', () => {
  it('sends authenticated idempotent writes, renews once and maps conflict/password errors', async () => {
    const json = (data: unknown, status = 200) => new Response(JSON.stringify({ success: true, data }), { status })
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(json({ access_token: 'renewed' })).mockResolvedValueOnce(json({ completed: true }))
    await expect(new AuthClient('https://api.invalid', fetcher).accountRequest('/password', 'POST', password, undefined, { key: 'one-change' })).resolves.toEqual({ completed: true })
    expect(fetcher.mock.calls[2]![1]).toMatchObject({ credentials: 'include', cache: 'no-store', headers: { Authorization: 'Bearer renewed', 'Idempotency-Key': 'one-change' } })
    await expect(new AuthClient('', vi.fn().mockResolvedValue(json({}, 409))).accountRequest('', 'PUT', {} as AccountInput)).rejects.toMatchObject({ code: 'CONFLICT' })
    await expect(new AuthClient('', vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'WRONG_PASSWORD' }), { status: 422 }))).accountRequest('/password', 'POST', {})).rejects.toMatchObject({ code: 'WRONG_PASSWORD' })
  })
})
