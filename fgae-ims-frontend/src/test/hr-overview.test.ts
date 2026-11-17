import { describe, expect, it, vi } from 'vitest'
import { accounts } from '../mocks/identities'
import { authService } from '../mocks/auth'
import { accountService } from '../mocks/account'
import { hrOverviewService } from '../mocks/hr-overview'
import { canReadHr, canReadHrBranch, mapHrOverview } from '../services/contracts/hr-overview'
import { personnelBranches } from '../mocks/personnel'
import { AuthClient } from '../services/http/auth-client'
const hr = accounts.find(identity => identity.email === 'hr@example.test')!
const login = (email = hr.email) => authService.signIn({ email, password: 'Demo-only-2026!' })
describe('HR overview permissions and records', () => {
  it('allows active HR and global Super Admin only', async () => {
    await expect(hrOverviewService.load()).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
    for (const identity of accounts) expect(canReadHr(identity)).toBe(!identity.mustChangePassword && ['hr@example.test', 'super.admin@example.test'].includes(identity.email))
    await login('volunteer@example.test'); await expect(hrOverviewService.load()).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await login('first.hr@example.test'); await expect(hrOverviewService.load()).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
  it('keeps each HR grant paired with its scope, including mixed roles and multiple branches', () => {
    const mixed = { ...hr, grants: [...hr.grants, { role: 'AREA_MANAGER' as const, scope: { kind: 'area' as const, id: 'fictional-area-b' } }] }
    expect(canReadHrBranch(mixed, personnelBranches[0]!)).toBe(true)
    expect(canReadHrBranch(mixed, personnelBranches[1]!)).toBe(false)
    expect(canReadHrBranch({ ...hr, grants: [{ role: 'HR', scope: { kind: 'area', id: 'fictional-area-b' } }] }, personnelBranches[1]!)).toBe(true)
    expect(canReadHrBranch({ ...hr, grants: [...hr.grants, { role: 'HR', scope: { kind: 'branch', id: 'fictional-branch-b' } }] }, personnelBranches[1]!)).toBe(true)
    expect(canReadHr({ ...hr, grants: [{ role: 'HR', scope: { kind: 'project', id: 'a' } }] })).toBe(false)
    expect(canReadHr({ ...hr, accountState: 'PENDING' })).toBe(false)
  })
  it('filters every count, branch and recent record to authorized scope', async () => {
    await login(); const { overview } = await hrOverviewService.load()
    expect(overview.counts).toEqual({ total: 3, active: 2, onLeave: 1, ended: 0, needsContact: 1, needsJob: 1 })
    expect(overview.branches.map(branch => branch.id)).toEqual(['fictional-branch-a'])
    expect(overview.recent.every(person => person.branchId === 'fictional-branch-a')).toBe(true)
    expect(JSON.stringify(overview)).not.toMatch(/fictional-branch-b|accountEmail|password|salt|digest/)
    await login('super.admin@example.test'); const global = (await hrOverviewService.load()).overview
    expect(global.counts.total).toBe(5); expect(global.counts.ended).toBe(1); expect(global.branches).toHaveLength(2)
  })
  it('shows true empty coverage for unmapped scope and rejects cancellation', async () => {
    vi.spyOn(authService, 'restore').mockResolvedValue({ ...hr, grants: [{ role: 'HR', scope: { kind: 'branch', id: 'no-branch' } }] })
    const { overview } = await hrOverviewService.load(); expect(overview.counts.total).toBe(0); expect(overview.branches).toEqual([]); expect(overview.recent).toEqual([])
    const controller = new AbortController(); controller.abort(); await expect(hrOverviewService.load(controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })
  it('shares permitted profile data without altering employment or scope', async () => {
    await login(); const before = (await hrOverviewService.load()).overview; const { profile } = await accountService.load()
    await accountService.save({ ...profile, name: 'Updated HR name', phone: '+251911111111' })
    const after = (await hrOverviewService.load()).overview
    expect(after.counts.needsContact).toBe(0); expect(after.counts.needsJob).toBe(before.counts.needsJob)
    expect(after.recent[0]).toMatchObject({ name: 'Updated HR name', jobTitle: 'HR officer', employment: 'ACTIVE', branchId: 'fictional-branch-a' })
    expect(after.branches).toEqual(before.branches)
  })
  it('fails closed for mismatched owners, out-of-scope locations and inconsistent summaries', async () => {
    await login(); const { overview } = await hrOverviewService.load()
    for (const data of [null, { ...overview, ownerId: 'other' }, { ...overview, branches: personnelBranches }, { ...overview, generatedAt: 'yesterday' }, { ...overview, counts: { ...overview.counts, total: 99 } }, { ...overview, recent: [] }, { ...overview, recent: [overview.recent[0], overview.recent[0], overview.recent[2]] }, { ...overview, recent: [{ ...overview.recent[0], branchId: 'other' }, ...overview.recent.slice(1)] }, { ...overview, counts: { ...overview.counts, needsJob: -1 } }]) expect(() => mapHrOverview(data, hr)).toThrow('UNAVAILABLE')
  })
  it('handles expired and offline sessions without reporting empty data', async () => {
    await login(); vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false); await expect(hrOverviewService.load()).rejects.toMatchObject({ code: 'NETWORK' }); vi.restoreAllMocks()
    const session = JSON.parse(sessionStorage.getItem('fgae.synthetic.auth.v1')!); sessionStorage.setItem('fgae.synthetic.auth.v1', JSON.stringify({ ...session, expiresAt: 0 }))
    await expect(hrOverviewService.load()).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
  })
  it('uses authenticated no-store transport with one renewal and generation checks', async () => {
    const json = (data: unknown, status = 200) => new Response(JSON.stringify({ success: true, data }), { status })
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(json({ access_token: 'hr-token' })).mockResolvedValueOnce(json({}))
    const client = new AuthClient('/api', fetcher); await client.hrOverview()
    expect(fetcher.mock.calls[2]).toEqual(['/api/workspaces/hr/overview', expect.objectContaining({ cache: 'no-store', credentials: 'include', headers: { Authorization: 'Bearer hr-token' } })])
    fetcher.mockResolvedValueOnce(json({}, 403)); await expect(client.hrOverview()).rejects.toMatchObject({ code: 'FORBIDDEN' })
    fetcher.mockImplementationOnce(async () => { client.clear(); return json({}) }); await expect(client.hrOverview()).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
  })
})
