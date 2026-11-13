import { describe, expect, it, vi } from 'vitest'
import { applicationStatuses, canReadOwnApplication, mapOwnApplication, type OwnApplication } from '../services/contracts/application'
import { accounts } from '../mocks/identities'
import { applicationService } from '../mocks/application'
import { authService } from '../mocks/auth'
import { AuthClient } from '../services/http/auth-client'
import { registerApplicant } from '../mocks/credentials'
import { webcrypto } from 'node:crypto'

const owner = accounts.find(account => account.email === 'pending@example.test')!
const at = '2026-11-09T08:00:00.000Z'
const record: OwnApplication = { id: 'own-record', ownerId: owner.id, status: 'PENDING', submittedAt: at, updatedAt: at,
  fields: { fullName: 'Test Applicant', email: owner.email, phone: '', birthDate: '', gender: '', branchId: 'branch-a' }, branchName: 'Branch A', documents: [],
  history: [{ id: 'submitted', status: 'PENDING', at, note: '' }],
}
const json = (data: unknown, status = 200) => new Response(JSON.stringify({ success: true, data }), { status })
describe('own application authorization and contract', () => {
  it('allows pending applicants and self-scoped volunteers, denying other roles and temporary credentials', () => {
    for (const identity of accounts) {
      expect(canReadOwnApplication(identity)).toBe(!identity.mustChangePassword && (identity.accountState === 'PENDING' || identity.grants.some(grant => grant.role === 'VOLUNTEER')))
    }
    expect(canReadOwnApplication({ ...accounts[7]!, grants: [{ role: 'VOLUNTEER', scope: { kind: 'self', id: 'someone-else' } }] })).toBe(false)
  })
  it('maps each known decision, empty results and plain text feedback', () => {
    expect(mapOwnApplication(null, owner.id)).toBeNull()
    for (const status of applicationStatuses) {
      const value = { ...record, status, history: [...record.history, { id: 'decision', status, at, note: '<script>plain text</script>' }] }
      expect(mapOwnApplication(value, owner.id)).toEqual(value)
    }
  })
  it('rejects mismatched owners, malformed dates/documents, unknown statuses and inconsistent history', () => {
    for (const change of [
      { ownerId: 'other-owner' }, { status: 'UNKNOWN' }, { history: [] }, { submittedAt: 'yesterday' },
      { fields: { ...record.fields, birthDate: '2000-02-30' } }, { fields: { ...record.fields, gender: 'INVALID' } },
      { documents: [{ id: 'x', typeId: 'id', name: 'x.svg', mime: 'image/svg+xml', size: 1 }] },
      { history: [{ ...record.history[0], status: 'APPROVED' }] }, { history: [record.history[0], record.history[0]] },
    ]) expect(() => mapOwnApplication({ ...record, ...change }, owner.id)).toThrow('INVALID_RESPONSE')
    expect(() => mapOwnApplication(undefined, owner.id)).toThrow('INVALID_RESPONSE')
  })
  it('requires a current session, rejects unrelated roles, and reads only the signed-in owner', async () => {
    await expect(applicationService.own()).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
    await authService.signIn({ email: owner.email, password: 'Demo-only-2026!' })
    expect((await applicationService.own()).application?.ownerId).toBe(owner.id)
    await authService.signIn({ email: 'super.admin@example.test', password: 'Demo-only-2026!' })
    await expect(applicationService.own()).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await authService.signIn({ email: 'first.login@example.test', password: 'Demo-only-2026!' })
    await expect(applicationService.own()).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
  it('continues real synthetic registrations without exposing password verifiers or granting roles', async () => {
    vi.stubGlobal('crypto', webcrypto)
    try {
      const fields = { ...record.fields, email: 'new.owner@example.test', birthDate: '2000-02-29', gender: 'UNDISCLOSED', branchId: 'fictional-branch-a' }
      const password = 'A fictional registration phrase'
      const receipt = await registerApplicant({ fields, documents: [], password, confirmation: password, confirmed: true, configVersion: 'v1', idempotencyKey: 'own-record-key' })
      await authService.signIn({ email: fields.email, password })
      const snapshot = await applicationService.own()
      expect(snapshot.application).toMatchObject({ id: receipt.id, fields, status: 'PENDING' })
      expect(snapshot.identity.grants).toEqual([])
      expect(JSON.stringify(snapshot)).not.toMatch(/digest|salt|idempotency|fictional registration phrase/)
    } finally { vi.unstubAllGlobals() }
  })
  it('expires stale sessions and rejects offline reads or cancellation', async () => {
    await authService.signIn({ email: owner.email, password: 'Demo-only-2026!' })
    const saved = JSON.parse(sessionStorage.getItem('fgae.synthetic.auth.v1')!)
    sessionStorage.setItem('fgae.synthetic.auth.v1', JSON.stringify({ ...saved, expiresAt: 0 }))
    await expect(applicationService.own()).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    await expect(applicationService.own()).rejects.toMatchObject({ code: 'NETWORK' })
    const controller = new AbortController(); controller.abort()
    await expect(applicationService.own(controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })
})
describe('authenticated application transport', () => {
  it('renews once, sends bearer/cookie/no-store and never accepts a caller-provided owner id', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(json({ access_token: 'renewed' })).mockResolvedValueOnce(json({ application: record }))
    const client = new AuthClient('https://api.invalid', fetcher)
    expect(await client.ownApplication()).toEqual({ application: record })
    expect(fetcher.mock.calls.map(call => call[0])).toEqual(['https://api.invalid/volunteers/applications/me', 'https://api.invalid/auth/refresh', 'https://api.invalid/volunteers/applications/me'])
    expect(fetcher.mock.calls[2]![1]).toMatchObject({ method: 'GET', credentials: 'include', cache: 'no-store', headers: { Authorization: 'Bearer renewed' } })
  })
  it('handles denied/rate-limited/server errors and rejects stale completion after account change', async () => {
    for (const [status, code] of [[403, 'FORBIDDEN'], [429, 'RATE_LIMITED'], [503, 'UNAVAILABLE']] as const) {
      await expect(new AuthClient('', vi.fn().mockResolvedValue(json({}, status))).ownApplication()).rejects.toMatchObject({ code })
    }
    let finish!: (value: Response) => void
    const client = new AuthClient('', vi.fn(() => new Promise<Response>(resolve => { finish = resolve })))
    const pending = client.ownApplication(); client.clear(); finish(json({ application: record }))
    await expect(pending).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
  })
})
