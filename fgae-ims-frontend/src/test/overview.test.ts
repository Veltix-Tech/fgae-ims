import { describe, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { accounts } from '../mocks/identities'
import { authService } from '../mocks/auth'
import { overviewService } from '../mocks/overview'
import { readWorkflow, changeWorkflow } from '../mocks/correction-store'
import { registerApplicant } from '../mocks/credentials'
import { canReadOverview, mapOverview } from '../services/contracts/overview'
import { AuthClient } from '../services/http/auth-client'
const admin = accounts[0]!
const login = (email = admin.email) => authService.signIn({ email, password: 'Demo-only-2026!' })
const empty = { ownerId: admin.id, scope: 'global', generatedAt: '2026-11-14T10:00:00Z', counts: { PENDING: 0, RETURNED: 0, APPROVED: 0, REJECTED: 0 }, recent: [] }
describe('Super Admin overview', () => {
  it('requires an active global Super Admin and rejects pending, temporary and unrelated grants', async () => {
    await expect(overviewService.load()).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
    for (const identity of accounts) {
      const allowed = identity.email === admin.email
      expect(canReadOverview(identity)).toBe(allowed)
      await login(identity.email)
      if (allowed) expect((await overviewService.load()).identity.id).toBe(admin.id)
      else await expect(overviewService.load()).rejects.toMatchObject({ code: 'FORBIDDEN' })
    }
    expect(canReadOverview({ ...admin, grants: [{ role: 'SUPER_ADMIN', scope: { kind: 'branch', id: 'a' } }] })).toBe(false)
    expect(canReadOverview({ ...admin, accountState: 'PENDING' })).toBe(false)
  })
  it('derives counts from unique application owners and follows correction updates', async () => {
    await login()
    const before = (await overviewService.load()).overview
    expect(before.counts).toEqual({ PENDING: 1, RETURNED: 1, APPROVED: 1, REJECTED: 0 })
    const returned = readWorkflow('fictional-returned-applicant')!
    await changeWorkflow(returned.application.ownerId, async () => {}, workflow => { workflow.application.status = 'PENDING'; workflow.application.updatedAt = '2026-11-14T09:00:00Z'; workflow.application.history.push({ id: 'resubmitted', at: workflow.application.updatedAt, status: 'PENDING', note: '' }) })
    const after = (await overviewService.load()).overview
    expect(after.counts).toEqual({ PENDING: 2, RETURNED: 0, APPROVED: 1, REJECTED: 0 })
    expect(after.recent[0]?.id).toBe(returned.application.id)
    expect(JSON.stringify(after)).not.toMatch(/password|digest|salt|documents|birthDate|email/)
  })
  it('includes saved registrations without granting access or counting them twice', async () => {
    vi.stubGlobal('crypto', webcrypto)
    try {
      const password = 'A fictional registration phrase'
      await registerApplicant({ fields: { fullName: 'New applicant', email: 'overview@example.test', phone: '+251911111111', birthDate: '2000-02-29', gender: 'UNDISCLOSED', branchId: 'fictional-branch-a' }, documents: [], password, confirmation: password, confirmed: true, configVersion: 'v1', idempotencyKey: 'overview-registration' })
      await login()
      expect((await overviewService.load()).overview.counts.PENDING).toBe(2)
      expect((await overviewService.load()).overview.recent.filter(record => record.name === 'New applicant')).toHaveLength(1)
    } finally { vi.unstubAllGlobals() }
  })
  it('validates owner, scope, counts, duplicates, statuses and recent record metadata', () => {
    expect(mapOverview(empty, admin.id).recent).toEqual([])
    const record = { id: 'a', name: 'Applicant', branch: 'Branch', status: 'PENDING', updatedAt: empty.generatedAt }
    for (const value of [null, { ...empty, ownerId: 'other' }, { ...empty, scope: 'branch' }, { ...empty, generatedAt: 'bad' }, { ...empty, counts: { ...empty.counts, PENDING: -1 } }, { ...empty, recent: [record] }, { ...empty, counts: { ...empty.counts, PENDING: 2 }, recent: [record, record] }, { ...empty, recent: [{ ...record, status: 'UNKNOWN' }] }]) expect(() => mapOverview(value, admin.id)).toThrow('UNAVAILABLE')
  })
  it('rejects offline and expired sessions instead of reporting zero counts', async () => {
    await login(); vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    await expect(overviewService.load()).rejects.toMatchObject({ code: 'NETWORK' }); vi.restoreAllMocks()
    const session = JSON.parse(sessionStorage.getItem('fgae.synthetic.auth.v1')!)
    sessionStorage.setItem('fgae.synthetic.auth.v1', JSON.stringify({ ...session, expiresAt: 0 }))
    await expect(overviewService.load()).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
  })
  it('uses authenticated no-store transport, renews once and rejects denied or stale responses', async () => {
    const json = (data: unknown, status = 200) => new Response(JSON.stringify({ success: true, data }), { status })
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(json({ access_token: 'renewed' })).mockResolvedValueOnce(json(empty))
    const client = new AuthClient('/api', fetcher)
    expect(await client.adminOverview()).toEqual(empty)
    expect(fetcher.mock.calls[2]).toEqual(['/api/workspaces/super-admin/overview', expect.objectContaining({ cache: 'no-store', credentials: 'include', headers: { Authorization: 'Bearer renewed' } })])
    fetcher.mockResolvedValueOnce(json({}, 403)); await expect(client.adminOverview()).rejects.toMatchObject({ code: 'FORBIDDEN' })
    fetcher.mockImplementationOnce(async () => { client.clear(); return json(empty) }); await expect(client.adminOverview()).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
  })
})
