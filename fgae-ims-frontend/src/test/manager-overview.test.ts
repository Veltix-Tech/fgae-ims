import { describe, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { managerKinds, managerRoles, canReadManager, canReadLocation, mapManagerOverview } from '../services/contracts/manager-overview'
import { accounts } from '../mocks/identities'
import { authService } from '../mocks/auth'
import { managerOverviewService } from '../mocks/manager-overview'
import { workLocations } from '../mocks/operations'
import { registerApplicant } from '../mocks/credentials'
import { changeWorkflow } from '../mocks/correction-store'
import { AuthClient } from '../services/http/auth-client'
for (const kind of managerKinds) describe(`${kind} overview`, () => {
  const identity = accounts.find(item => !item.mustChangePassword && item.grants.some(grant => grant.role === managerRoles[kind]))!
  const login = () => authService.signIn({ email: identity.email, password: 'Demo-only-2026!' })
  it('requires the matching active scoped role or global Super Admin', async () => {
    await expect(managerOverviewService.load(kind)).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
    for (const person of accounts) expect(canReadManager(person, kind)).toBe(!person.mustChangePassword && (person.id === identity.id || person.email === 'super.admin@example.test'))
    await authService.signIn({ email: 'hr@example.test', password: 'Demo-only-2026!' }); await expect(managerOverviewService.load(kind)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(canReadManager({ ...identity, accountState: 'PENDING' }, kind)).toBe(false)
  })
  it('does not widen a manager scope using another role, and unions same-role scopes', () => {
    const other = workLocations.find(item => item.id === 'fictional-branch-b')!
    const mixed = { ...identity, grants: [...identity.grants, { role: 'HR' as const, scope: { kind: 'global' as const, id: '*' } }] }
    expect(canReadLocation(mixed, kind, other)).toBe(false)
    const added = { role: managerRoles[kind], scope: kind === 'area-manager' ? { kind: 'area' as const, id: 'fictional-area-b' } : { kind: 'branch' as const, id: 'fictional-branch-b' } }
    expect(canReadLocation({ ...identity, grants: [...identity.grants, added] }, kind, other)).toBe(true)
    expect(canReadManager({ ...identity, grants: [{ role: managerRoles[kind], scope: { kind: 'self', id: identity.id } }] }, kind)).toBe(false)
  })
  it('derives scoped counts from linked work, assignments, attendance and distinct profiles', async () => {
    await login(); const { overview } = await managerOverviewService.load(kind)
    expect(overview.counts).toMatchObject({ work: kind === 'area-manager' ? 4 : 3, active: 1, unfilled: kind === 'area-manager' ? 6 : 4, supervision: 1, attendance: 1, volunteers: 1, pending: kind === 'volunteer-manager' ? 1 : 0, returned: kind === 'volunteer-manager' ? 1 : 0 })
    expect(overview.locations.every(item => item.areaId === 'fictional-area-a')).toBe(true)
    expect(JSON.stringify(overview)).not.toMatch(/Branch B|fictional-area-b|password|salt|digest|email|birthDate/)
    expect(overview.work.at(-1)?.state).toBe('COMPLETED')
    if (kind !== 'volunteer-manager') expect(overview.applications).toEqual([])
    await authService.signIn({ email: 'super.admin@example.test', password: 'Demo-only-2026!' }); expect((await managerOverviewService.load(kind)).overview.counts.work).toBe(kind === 'area-manager' ? 5 : 4)
  })
  it('rejects malformed scope, owner, counts, dates, duplicate rows and hidden application data', async () => {
    await login(); const { overview } = await managerOverviewService.load(kind)
    const outside = workLocations.find(item => item.id === 'fictional-branch-b')!
    for (const value of [null, { ...overview, ownerId: 'other' }, { ...overview, kind: 'invalid' }, { ...overview, generatedAt: 'yesterday' }, { ...overview, locations: [...overview.locations, outside] }, { ...overview, counts: { ...overview.counts, attendance: -1 } }, { ...overview, counts: { ...overview.counts, active: 0 } }, { ...overview, work: [] }, { ...overview, work: [overview.work[0], ...overview.work.slice(0, -1)] }, { ...overview, work: [{ ...overview.work[0], assigned: 99 }, ...overview.work.slice(1)] }]) expect(() => mapManagerOverview(value, identity, kind)).toThrow('UNAVAILABLE')
  })
  it('returns true empty data for an unmapped scope and fails on offline or expired sessions', async () => {
    await login(); vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false); await expect(managerOverviewService.load(kind)).rejects.toMatchObject({ code: 'NETWORK' }); vi.restoreAllMocks()
    const session = JSON.parse(sessionStorage.getItem('fgae.synthetic.auth.v1')!); sessionStorage.setItem('fgae.synthetic.auth.v1', JSON.stringify({ ...session, expiresAt: 0 })); await expect(managerOverviewService.load(kind)).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
    vi.spyOn(authService, 'restore').mockResolvedValue({ ...identity, grants: [{ role: managerRoles[kind], scope: { kind: kind === 'area-manager' ? 'area' : 'branch', id: 'unmapped' } }] })
    const { overview } = await managerOverviewService.load(kind); expect(overview.locations).toEqual([]); expect(Object.values(overview.counts).every(value => value === 0)).toBe(true)
    const controller = new AbortController(); controller.abort(); await expect(managerOverviewService.load(kind, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })
  it('uses authenticated no-store transport, renews once and rejects stale sessions', async () => {
    const json = (data: unknown, status = 200) => new Response(JSON.stringify({ success: true, data }), { status })
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(json({ access_token: 'token' })).mockResolvedValueOnce(json({}))
    const client = new AuthClient('/api', fetcher); await client.managerOverview(kind)
    expect(fetcher.mock.calls[2]).toEqual([`/api/workspaces/${kind}/overview`, expect.objectContaining({ cache: 'no-store', credentials: 'include', headers: { Authorization: 'Bearer token' } })])
    fetcher.mockResolvedValueOnce(json({}, 403)); await expect(client.managerOverview(kind)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    fetcher.mockImplementationOnce(async () => { client.clear(); return json({}) }); await expect(client.managerOverview(kind)).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
  })
})
it('reflects signup and returned-application resubmission in VM counts without granting volunteer access', async () => {
  vi.stubGlobal('crypto', webcrypto)
  try {
    const password = 'Fictional application password'
    await registerApplicant({ fields: { fullName: 'New applicant', email: 'manager.new@example.test', phone: '+251911111111', birthDate: '2000-02-29', gender: 'UNDISCLOSED', branchId: 'fictional-branch-a' }, documents: [], password, confirmation: password, confirmed: true, configVersion: 'v1', idempotencyKey: 'manager-signup' })
    await authService.signIn({ email: 'volunteer.manager@example.test', password: 'Demo-only-2026!' })
    const before = (await managerOverviewService.load('volunteer-manager')).overview
    expect(before.counts).toMatchObject({ pending: 2, returned: 1, volunteers: 1 })
    await changeWorkflow('fictional-returned-applicant', async () => {}, workflow => { workflow.application.status = 'PENDING'; workflow.application.updatedAt = '2026-11-17T12:00:00Z'; workflow.application.history.push({ id: 'new-submit', status: 'PENDING', at: workflow.application.updatedAt, note: '' }) })
    expect((await managerOverviewService.load('volunteer-manager')).overview.counts).toMatchObject({ pending: 3, returned: 0, volunteers: 1 })
  } finally { vi.unstubAllGlobals() }
})
