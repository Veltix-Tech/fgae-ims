import { authService } from './auth'
import { accounts } from './identities'
import { allocations, assignments, attendance, workLocations } from './operations'
import { allowanceRecords, budgetRecords } from './participant-records'
import { findAccount, readProfile, readRegisteredIdentities, applyAccessDirectory } from './credentials'
import { canReadPortfolio, canReadProject, canReadMembership, mapPortfolio, type PortfolioService, type ProjectRow, type MembershipRow, type DirectoryUser } from '../services/contracts/portfolio'
import { ManagerError } from '../services/contracts/manager-overview'
export function projectSummaries(): ProjectRow[] {
  return ['a', 'b'].map(suffix => {
    const id = `fictional-project-${suffix}`
    return { id, name: suffix === 'a' ? 'Demo community outreach project' : 'Outside project', state: 'ACTIVE', startAt: '2026-11-01T00:00:00Z', endAt: '2026-12-31T20:59:59Z',
      availableMinor: budgetRecords.filter(row => row.projectId === id).reduce((sum, row) => sum + row.availableMinor, 0),
      work: allocations.filter(row => row.areaId === `fictional-area-${suffix}`).map(row => {
        const assigned = assignments.filter(item => item.workId === row.id)
        return { id: row.id, title: row.title, state: row.state, dueAt: row.dueAt, volunteerIds: [...new Set(assigned.map(item => item.volunteerId))], attendance: attendance.filter(item => assigned.some(assignment => assignment.id === item.assignmentId)).map(item => ({ id: item.id, verification: item.state === 'APPROVED' ? 'VERIFIED' as const : 'PENDING' as const })) }
      }), allowances: allowanceRecords.filter(row => row.projectId === id).map(row => ({ id: row.id, state: row.state, amountMinor: row.amountMinor!, updatedAt: row.updatedAt })) }
  })
}
// Fictional membership configuration; no organizational dues or renewal policy is inferred.
export const membershipRecords: MembershipRow[] = [
  { id: 'synthetic-membership-9', ownerId: 'fictional-person-9', name: 'Demo 10', status: 'ACTIVE_MEMBER', review: 'APPROVED', category: 'Demo community membership', duesMinor: 15000, expiresAt: null, renewalEligible: false,
    history: [{ id: 'membership-submitted', status: 'PENDING', at: '2026-11-01T08:00:00Z', note: '' }, { id: 'membership-approved', status: 'APPROVED', at: '2026-11-03T08:00:00Z', note: '' }],
    payments: [{ id: 'synthetic-membership-payment-1', amountMinor: 15000, state: 'SUCCESSFUL', at: '2026-11-02T08:00:00Z' }, { id: 'synthetic-membership-payment-2', amountMinor: 15000, state: 'PENDING', at: '2026-11-17T08:00:00Z' }] },
  { id: 'synthetic-membership-7', ownerId: 'fictional-person-7', name: 'Demo 8', status: 'APPLIED', review: 'RETURNED', category: 'Demo community membership', duesMinor: 15000, expiresAt: null, renewalEligible: false, history: [{ id: 'membership-returned-7', status: 'RETURNED', at: '2026-11-17T08:00:00Z', note: 'Please confirm the membership category.' }], payments: [] },
]
export function directoryUsers(): DirectoryUser[] {
  const unique = new Map<string, DirectoryUser>()
  for (const fixture of [...accounts, ...readRegisteredIdentities()]) {
    const identity = findAccount(fixture.email) ?? fixture
    const profile = readProfile(identity)
    const row = unique.get(identity.id) ?? { id: identity.id, name: profile.name, email: identity.email, state: identity.accountState, mustChangePassword: identity.mustChangePassword, grants: [] }
    for (const grant of identity.grants) if (!row.grants.some(item => item.role === grant.role && item.scope.kind === grant.scope.kind && item.scope.id === grant.scope.id)) row.grants.push({ ...grant, scopeName: workLocations.find(item => item.id === grant.scope.id)?.name ?? (grant.scope.kind === 'project' ? 'Demo community outreach project' : grant.scope.kind === 'self' || grant.scope.kind === 'supervision' ? profile.name : '*') })
    unique.set(identity.id, row)
  }
  return applyAccessDirectory([...unique.values(), { id: 'synthetic-suspended-user', name: 'Demo suspended account', email: 'suspended@example.test', state: 'SUSPENDED', mustChangePassword: false, grants: [] }, { id: 'synthetic-inactive-user', name: 'Demo inactive account', email: 'inactive@example.test', state: 'INACTIVE', mustChangePassword: false, grants: [] }])
}
export const portfolioService: PortfolioService = {
  async load(kind, signal) {
    const identity = await authService.restore(signal)
    if (!identity) throw new ManagerError('SESSION_EXPIRED')
    if (!canReadPortfolio(identity, kind)) throw new ManagerError('FORBIDDEN')
    signal?.throwIfAborted()
    return { identity, overview: mapPortfolio({ ownerId: identity.id, kind, complete: true, generatedAt: new Date().toISOString(), projects: kind === 'project-manager' ? projectSummaries().filter(row => canReadProject(identity, row.id)) : [], memberships: kind === 'member' ? membershipRecords.filter(row => canReadMembership(identity, row.ownerId)).map(row => {
      const person = accounts.find(item => item.id === row.ownerId)
      return { ...row, name: person ? readProfile(person).name : row.name }
    }) : [], users: kind === 'users' ? directoryUsers() : [] }, identity, kind) }
  },
}
