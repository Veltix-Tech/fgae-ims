import { describe, expect, it, vi } from 'vitest'
import { accounts } from '../mocks/identities'
import { authService } from '../mocks/auth'
import { participantOverviewService } from '../mocks/participant-overview'
import { allowanceRecords, participantAssignments, participantAttendance } from '../mocks/participant-records'
import { canReadParticipant, canReadParticipantRow, financeEligible, mapParticipantOverview, participantKinds, participantRoles } from '../services/contracts/participant-overview'
import { AuthClient } from '../services/http/auth-client'
for (const kind of participantKinds) describe(`${kind} overview`, () => {
  const identity = accounts.find(person => person.email === `${kind.replaceAll('-', '.')}@example.test`)!
  const login = () => authService.signIn({ email: identity.email, password: 'Demo-only-2026!' })
  it('requires an active matching role and scope; temporary/pending sessions are denied', async () => {
    await expect(participantOverviewService.load(kind)).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
    for (const person of accounts) expect(canReadParticipant(person, kind)).toBe(!person.mustChangePassword && (person.id === identity.id || person.email === 'super.admin@example.test'))
    expect(canReadParticipant({ ...identity, accountState: 'PENDING' }, kind)).toBe(false)
    expect(canReadParticipant({ ...identity, grants: [{ role: participantRoles[kind], scope: { kind: 'self', id: 'another' } }] }, kind)).toBe(false)
    await authService.signIn({ email: 'hr@example.test', password: 'Demo-only-2026!' }); await expect(participantOverviewService.load(kind)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
  it('rejects unrelated-role widening, unassigned supervision and another volunteer', () => {
    const row = allowanceRecords.at(-1)!
    expect(canReadParticipantRow({ ...identity, grants: [...identity.grants, { role: 'HR', scope: { kind: 'global', id: '*' } }] }, kind, row)).toBe(false)
    const scope = kind === 'field-supervisor' ? { kind: 'supervision' as const, id: row.supervisorId } : kind === 'finance-officer' ? { kind: 'branch' as const, id: row.branchId } : { kind: 'self' as const, id: row.volunteerId }
    expect(canReadParticipantRow({ ...identity, grants: [...identity.grants, { role: participantRoles[kind], scope }] }, kind, row)).toBe(kind !== 'volunteer')
  })
  it('returns linked scoped rows without widening or inappropriate money fields', async () => {
    await login(); const { overview } = await participantOverviewService.load(kind)
    expect(overview.complete).toBe(true); expect(overview.allowances).toHaveLength(10)
    expect(overview.assignments).toHaveLength(kind === 'finance-officer' ? 0 : kind === 'field-supervisor' ? 1 : 2)
    expect(overview.attendance.every(row => overview.assignments.some(item => item.id === row.assignmentId))).toBe(true)
    expect(overview.payments).toHaveLength(kind === 'field-supervisor' ? 0 : 4)
    expect(overview.budgets).toHaveLength(kind === 'finance-officer' ? 1 : 0)
    expect(JSON.stringify(overview)).not.toMatch(/Outside branch|fictional-outside|password|email|birthDate/)
    if (kind === 'field-supervisor') expect(overview.allowances.every(row => row.amountMinor === null)).toBe(true)
    await authService.signIn({ email: 'super.admin@example.test', password: 'Demo-only-2026!' }); expect((await participantOverviewService.load(kind)).overview.allowances).toHaveLength(11)
  })
  it('fails closed on partial snapshots, wrong owners, invalid money, malformed rows and leaked scope', async () => {
    await login(); const { overview } = await participantOverviewService.load(kind)
    const invalid = [null, { ...overview, complete: false }, { ...overview, ownerId: 'other' }, { ...overview, kind: 'other' }, { ...overview, generatedAt: 'today' }, { ...overview, allowances: [...overview.allowances, overview.allowances[0]] }, { ...overview, allowances: [{ ...overview.allowances[0], amountMinor: -1 }] }, { ...overview, allowances: [{ ...allowanceRecords.at(-1)!, amountMinor: kind === 'field-supervisor' ? null : 100 }] }, { ...overview, attendance: [{ id: 'a', assignmentId: 'outside', date: '2026-11-17', attendance: 'PRESENT', verification: 'PENDING', evidence: true }] }]
    for (const value of invalid) expect(() => mapParticipantOverview(value, identity, kind)).toThrow('UNAVAILABLE')
    if (overview.attendance.length) {
      expect(() => mapParticipantOverview({ ...overview, attendance: [{ ...overview.attendance[0], date: '2026-99-99' }] }, identity, kind)).toThrow('UNAVAILABLE')
      expect(() => mapParticipantOverview({ ...overview, attendance: [overview.attendance[0], { ...overview.attendance[0], id: 'duplicate-date' }] }, identity, kind)).toThrow('UNAVAILABLE')
    }
    if (kind !== 'finance-officer') expect(() => mapParticipantOverview({ ...overview, capabilities: { approve: true, disburse: true } }, identity, kind)).toThrow('UNAVAILABLE')
  })
  it('clears access on expiry, offline failure and cancellation; unmapped scope is truly empty', async () => {
    await login(); vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false); await expect(participantOverviewService.load(kind)).rejects.toMatchObject({ code: 'NETWORK' }); vi.restoreAllMocks()
    const session = JSON.parse(sessionStorage.getItem('fgae.synthetic.auth.v1')!); sessionStorage.setItem('fgae.synthetic.auth.v1', JSON.stringify({ ...session, expiresAt: 0 })); await expect(participantOverviewService.load(kind)).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
    const emptyIdentity = { ...identity, id: 'unmapped', grants: [{ role: participantRoles[kind], scope: { kind: kind === 'volunteer' ? 'self' as const : kind === 'field-supervisor' ? 'supervision' as const : 'branch' as const, id: 'unmapped' } }] }
    vi.spyOn(authService, 'restore').mockResolvedValue(emptyIdentity)
    const { overview } = await participantOverviewService.load(kind); expect(overview.assignments).toEqual([]); expect(overview.allowances).toEqual([]); expect(overview.payments).toEqual([])
    const controller = new AbortController(); controller.abort(); await expect(participantOverviewService.load(kind, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })
  it('uses authenticated no-store reads, a single renewal and generation protection', async () => {
    const json = (data: unknown, status = 200) => new Response(JSON.stringify({ success: true, data }), { status })
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(json({ access_token: 'token' })).mockResolvedValueOnce(json({}))
    const client = new AuthClient('/api', fetcher); await client.participantOverview(kind)
    expect(fetcher.mock.calls[2]).toEqual([`/api/workspaces/${kind}/overview`, expect.objectContaining({ cache: 'no-store', credentials: 'include', headers: { Authorization: 'Bearer token' } })])
    fetcher.mockResolvedValueOnce(json({}, 403)); await expect(client.participantOverview(kind)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    fetcher.mockImplementationOnce(async () => { client.clear(); return json({}) }); await expect(client.participantOverview(kind)).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
  })
})
it('keeps finance approval/disbursement capabilities separate and enforces P06 conflicts', async () => {
  await authService.signIn({ email: 'finance.officer@example.test', password: 'Demo-only-2026!' })
  const { identity, overview } = await participantOverviewService.load('finance-officer')
  expect(overview.allowances.filter(row => financeEligible(identity, overview, row, 'approve'))).toHaveLength(1)
  expect(overview.allowances.filter(row => financeEligible(identity, overview, row, 'disburse'))).toHaveLength(1)
  const readOnly = { ...overview, capabilities: { approve: false, disburse: false } }
  expect(overview.allowances.some(row => financeEligible(identity, readOnly, row, 'approve') || financeEligible(identity, readOnly, row, 'disburse'))).toBe(false)
  const approveOnly = { ...overview, capabilities: { approve: true, disburse: false } }
  expect(overview.allowances.some(row => financeEligible(identity, approveOnly, row, 'disburse'))).toBe(false)
  const admin = accounts[0]!
  expect(overview.allowances.filter(row => financeEligible(admin, overview, row, 'approve'))).toHaveLength(2)
  expect(overview.allowances.filter(row => financeEligible(admin, overview, row, 'disburse'))).toHaveLength(2)
  expect(overview.payments.filter(row => row.state === 'SUCCESSFUL').reduce((sum, row) => sum + row.amountMinor, 0)).toBe(15000)
  expect(overview.allowances.filter(row => row.state === 'PAID').reduce((sum, row) => sum + row.amountMinor!, 0)).toBe(50000)
})
it('reuses assignment and attendance identities across manager, supervisor and volunteer summaries', () => {
  const assignments = participantAssignments(); const attendance = participantAttendance()
  expect(assignments.map(row => row.id)).toEqual(['assignment-1', 'assignment-2'])
  expect(attendance.map(row => row.verification)).toEqual(['PENDING', 'VERIFIED'])
  expect(assignments[0]!.supervisorId).toBeNull()
  expect(assignments[1]!.supervisorId).toBe('fictional-person-5')
})
