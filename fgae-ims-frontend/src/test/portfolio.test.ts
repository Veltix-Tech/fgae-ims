import { describe, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { accounts } from '../mocks/identities'
import { authService } from '../mocks/auth'
import { portfolioService, directoryUsers, membershipRecords } from '../mocks/portfolio'
import { registerApplicant, saveProfile, readProfile } from '../mocks/credentials'
import { canReadPortfolio, canReadProject, canReadMembership, filterDirectory, mapPortfolio, portfolioKinds, portfolioPath } from '../services/contracts/portfolio'
import { AuthClient } from '../services/http/auth-client'
import { normalizePortfolioResponse } from '../services/adapters/live-portfolio'
const emails = { 'project-manager': 'project.manager@example.test', member: 'member@example.test', users: 'super.admin@example.test' }
for (const kind of portfolioKinds) describe(`${kind} workspace`, () => {
  const identity = accounts.find(person => person.email === emails[kind])!
  const login = () => authService.signIn({ email: identity.email, password: 'Demo-only-2026!' })
  it('requires matching active grants, rejecting pending and temporary sessions', async () => {
    await expect(portfolioService.load(kind)).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
    for (const person of accounts) expect(canReadPortfolio(person, kind)).toBe(!person.mustChangePassword && (person.email === 'super.admin@example.test' || kind === 'project-manager' && person.id === identity.id || kind === 'member' && (person.email === 'member@example.test' || person.email === 'multi.role@example.test')))
    expect(canReadPortfolio({ ...identity, accountState: 'PENDING' }, kind)).toBe(false)
    await authService.signIn({ email: 'hr@example.test', password: 'Demo-only-2026!' }); await expect(portfolioService.load(kind)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
  it('returns complete, scoped domain data and no irrelevant datasets', async () => {
    await login(); const { overview } = await portfolioService.load(kind)
    expect(overview.complete).toBe(true)
    expect(overview.projects).toHaveLength(kind === 'project-manager' ? 1 : 0)
    expect(overview.memberships).toHaveLength(kind === 'member' ? 1 : 0)
    expect(overview.users).toHaveLength(kind === 'users' ? 25 : 0)
    expect(JSON.stringify(overview)).not.toMatch(/digest|salt|passwordHash|Outside project/)
    if (kind === 'project-manager') { expect(overview.projects[0]!.work).toHaveLength(4); expect(overview.projects[0]!.availableMinor).toBe(250000); expect(overview.projects[0]!.allowances).toHaveLength(10) }
    if (kind === 'member') expect(overview.memberships[0]!.status).toBe('ACTIVE_MEMBER')
    await authService.signIn({ email: 'super.admin@example.test', password: 'Demo-only-2026!' }); const admin = (await portfolioService.load(kind)).overview
    if (kind === 'project-manager') expect(admin.projects).toHaveLength(2)
    if (kind === 'member') expect(admin.memberships).toHaveLength(2)
  })
  it('rejects partial data, wrong owners, duplicate rows and cross-domain leakage', async () => {
    await login(); const { overview } = await portfolioService.load(kind)
    const key = kind === 'project-manager' ? 'projects' : kind === 'member' ? 'memberships' : 'users'
    for (const value of [null, { ...overview, ownerId: 'other' }, { ...overview, complete: false }, { ...overview, kind: 'other' }, { ...overview, generatedAt: 'tomorrow' }, { ...overview, [key]: [overview[key][0], overview[key][0]] }, { ...overview, [key]: [null] }]) expect(() => mapPortfolio(value, identity, kind)).toThrow('UNAVAILABLE')
    if (kind !== 'users') expect(() => mapPortfolio({ ...overview, users: directoryUsers() }, identity, kind)).toThrow('UNAVAILABLE')
    else expect(() => mapPortfolio({ ...overview, memberships: membershipRecords }, identity, kind)).toThrow('UNAVAILABLE')
  })
  it('handles offline, expiry and cancellation without synthetic fallback', async () => {
    await login(); vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false); await expect(portfolioService.load(kind)).rejects.toMatchObject({ code: 'NETWORK' }); vi.restoreAllMocks()
    const session = JSON.parse(sessionStorage.getItem('fgae.synthetic.auth.v1')!); sessionStorage.setItem('fgae.synthetic.auth.v1', JSON.stringify({ ...session, expiresAt: 0 })); await expect(portfolioService.load(kind)).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
    await login(); const controller = new AbortController(); controller.abort(); await expect(portfolioService.load(kind, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })
  it('accepts true empty complete snapshots', async () => {
    await login(); const { overview } = await portfolioService.load(kind)
    expect(mapPortfolio({ ...overview, projects: [], memberships: [], users: [] }, identity, kind).complete).toBe(true)
  })
  it('uses authenticated no-store reads, one renewal, denial and generation guards', async () => {
    const json = (data: unknown, status = 200) => new Response(JSON.stringify({ success: true, data }), { status })
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(json({ access_token: 'token' })).mockResolvedValueOnce(json({}))
    const client = new AuthClient('/api', fetcher); await client.portfolio(kind)
    expect(fetcher.mock.calls[2]).toEqual([`/api${portfolioPath(kind)}/overview`, expect.objectContaining({ cache: 'no-store', credentials: 'include', headers: { Authorization: 'Bearer token' } })])
    fetcher.mockResolvedValueOnce(json({}, 403)); await expect(client.portfolio(kind)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    fetcher.mockImplementationOnce(async () => { client.clear(); return json({}) }); await expect(client.portfolio(kind)).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
  })
})
it('pairs project grants with project scope and member grants with own identity', () => {
  const project = accounts[8]!; const member = accounts[9]!
  expect(canReadProject({ ...project, grants: [...project.grants, { role: 'HR', scope: { kind: 'global', id: '*' } }] }, 'fictional-project-b')).toBe(false)
  expect(canReadProject({ ...project, grants: [...project.grants, { role: 'PROJECT_MANAGER', scope: { kind: 'project', id: 'fictional-project-b' } }] }, 'fictional-project-b')).toBe(true)
  expect(canReadMembership(member, 'fictional-person-7')).toBe(false)
  expect(canReadPortfolio({ ...member, grants: [{ role: 'MEMBER', scope: { kind: 'self', id: 'fictional-person-7' } }] }, 'member')).toBe(false)
})
it('validates project links, duplicate evidence, money precision and membership ownership', async () => {
  await authService.signIn({ email: emails['project-manager'], password: 'Demo-only-2026!' }); const project = await portfolioService.load('project-manager'); const row = project.overview.projects[0]!
  for (const invalid of [{ ...row, id: 'outside' }, { ...row, availableMinor: -1 }, { ...row, availableMinor: 1.1 }, { ...row, work: [{ ...row.work[0], dueAt: '2027-01-01T00:00:00Z' }] }, { ...row, work: [{ ...row.work[0], volunteerIds: ['same', 'same'] }] }, { ...row, allowances: [{ ...row.allowances[0], amountMinor: 0 }] }]) expect(() => mapPortfolio({ ...project.overview, projects: [invalid] }, project.identity, 'project-manager')).toThrow('UNAVAILABLE')
  await authService.signIn({ email: emails.member, password: 'Demo-only-2026!' }); const member = await portfolioService.load('member'); const record = member.overview.memberships[0]!
  for (const invalid of [{ ...record, ownerId: 'other' }, { ...record, duesMinor: -1 }, { ...record, payments: [{ ...record.payments[0], state: 'REDIRECT_SUCCESS' }] }]) expect(() => mapPortfolio({ ...member.overview, memberships: [invalid] }, member.identity, 'member')).toThrow('UNAVAILABLE')
  const independent = mapPortfolio({ ...member.overview, memberships: [{ ...record, status: 'APPLIED', review: 'RETURNED' }] }, member.identity, 'member')
  expect(independent.memberships[0]!.payments[0]!.state).toBe('SUCCESSFUL'); expect(independent.memberships[0]!.status).toBe('APPLIED')
})
it('deduplicates multi-role accounts, pairs grants and filters by combined criteria', () => {
  const users = directoryUsers(); expect(users.filter(row => row.id === 'fictional-person-7')).toHaveLength(1)
  expect(users.find(row => row.id === 'fictional-person-7')!.grants.map(grant => grant.role)).toEqual(['VOLUNTEER', 'MEMBER'])
  expect(filterDirectory(users, 'VOLUNTEER@EXAMPLE.TEST', 'ACTIVE', 'MEMBER')).toHaveLength(1)
  expect(filterDirectory(users, 'Demo branch A', 'ACTIVE', 'HR')).toHaveLength(2)
  expect(filterDirectory(users, '', 'SUSPENDED', '')).toHaveLength(1)
  expect(filterDirectory(users, 'missing person', '', '')).toHaveLength(0)
})
it('rejects duplicate emails and mismatched self grants in the directory', async () => {
  await authService.signIn({ email: emails.users, password: 'Demo-only-2026!' }); const { identity, overview } = await portfolioService.load('users')
  const user = overview.users.find(row => row.id === 'fictional-person-7')!
  for (const users of [[...overview.users, { ...user, id: 'duplicate-email' }], [{ ...user, grants: [{ role: 'VOLUNTEER', scope: { kind: 'self', id: 'other' }, scopeName: 'Other' }] }]]) expect(() => mapPortfolio({ ...overview, users }, identity, 'users')).toThrow('UNAVAILABLE')
})
it('normalizes legacy admin roles without granting unknown roles directory access', async () => {
  await authService.signIn({ email: emails.users, password: 'Demo-only-2026!' }); const { identity, overview } = await portfolioService.load('users')
  const user = overview.users[0]!
  const legacy = { ...overview, users: [{ ...user, grants: [{ role: 'SYSTEM_ADMIN', scope: { kind: 'global', id: '*' }, scopeName: '*' }] }] }
  expect(mapPortfolio(normalizePortfolioResponse(legacy), identity, 'users').users[0]!.grants[0]!.role).toBe('SUPER_ADMIN')
  const unknown = { ...legacy, users: [{ ...user, grants: [{ role: 'UNKNOWN', scope: { kind: 'global', id: '*' }, scopeName: '*' }] }] }
  expect(() => mapPortfolio(normalizePortfolioResponse(unknown), identity, 'users')).toThrow('UNAVAILABLE')
})
it('reflects persisted account edits and new registration in directory records', async () => {
  vi.stubGlobal('crypto', webcrypto)
  try {
    const member = accounts[9]!
    await saveProfile({ ...readProfile(member), name: 'Updated member' }, async () => member)
    expect(directoryUsers().find(row => row.id === member.id)!.name).toBe('Updated member')
    const password = 'Fictional directory password'
    await registerApplicant({ fields: { fullName: 'New directory applicant', email: 'directory.new@example.test', phone: '+251911111111', birthDate: '2000-02-29', gender: 'UNDISCLOSED', branchId: 'fictional-branch-a' }, documents: [], password, confirmation: password, confirmed: true, configVersion: 'v1', idempotencyKey: 'directory-signup' })
    expect(directoryUsers().find(row => row.email === 'directory.new@example.test')).toMatchObject({ name: 'New directory applicant', state: 'PENDING', grants: [] })
  } finally { vi.unstubAllGlobals() }
})
