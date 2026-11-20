import { roles, type Identity, type RoleGrant } from './auth'
import { ManagerError } from './manager-overview'
import { isGlobalAdmin } from './participant-overview'
export const portfolioKinds = ['project-manager', 'member', 'users'] as const
export type PortfolioKind = typeof portfolioKinds[number]
export const portfolioPath = (kind: PortfolioKind) => kind === 'users' ? '/users' : `/workspaces/${kind}`
export interface ProjectWork { id: string; title: string; state: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'; dueAt: string; volunteerIds: string[]; attendance: { id: string; verification: 'PENDING' | 'VERIFIED' | 'REJECTED' }[] }
export interface ProjectRow { id: string; name: string; state: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'; startAt: string; endAt: string; availableMinor: number; work: ProjectWork[]; allowances: { id: string; state: 'DRAFT' | 'SUBMITTED' | 'VERIFIED' | 'APPROVED' | 'PROCESSING' | 'PAID' | 'FAILED' | 'RETURNED' | 'CANCELLED'; amountMinor: number; updatedAt: string }[] }
export interface MembershipRow { id: string; ownerId: string; name: string; status: 'NOT_A_MEMBER' | 'APPLIED' | 'ACTIVE_MEMBER'; review: 'PENDING' | 'RETURNED' | 'APPROVED' | 'REJECTED' | null; category: string | null; duesMinor: number | null; expiresAt: string | null; renewalEligible: boolean; history: { id: string; status: 'PENDING' | 'RETURNED' | 'APPROVED' | 'REJECTED'; at: string; note: string }[]; payments: { id: string; amountMinor: number; state: 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'CANCELLED'; at: string }[] }
export interface DirectoryUser { id: string; name: string; email: string; state: 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'INACTIVE'; mustChangePassword: boolean; grants: (RoleGrant & { scopeName: string })[] }
export interface Portfolio { ownerId: string; kind: PortfolioKind; complete: true; generatedAt: string; projects: ProjectRow[]; memberships: MembershipRow[]; users: DirectoryUser[] }
export interface PortfolioSnapshot { identity: Identity; overview: Portfolio }
export interface PortfolioService { load(kind: PortfolioKind, signal?: AbortSignal): Promise<PortfolioSnapshot> }
export function canReadPortfolio(identity: Identity, kind: PortfolioKind) {
  return identity.accountState === 'ACTIVE' && !identity.mustChangePassword && (isGlobalAdmin(identity) || identity.grants.some(grant => kind === 'project-manager' ? grant.role === 'PROJECT_MANAGER' && grant.scope.kind === 'project' : kind === 'member' && grant.role === 'MEMBER' && grant.scope.kind === 'self' && grant.scope.id === identity.id))
}
export function canReadProject(identity: Identity, id: string) { return canReadPortfolio(identity, 'project-manager') && (isGlobalAdmin(identity) || identity.grants.some(grant => grant.role === 'PROJECT_MANAGER' && grant.scope.kind === 'project' && grant.scope.id === id)) }
export function canReadMembership(identity: Identity, ownerId: string) { return canReadPortfolio(identity, 'member') && (isGlobalAdmin(identity) || identity.id === ownerId) }
export function mapPortfolio(value: unknown, identity: Identity, kind: PortfolioKind): Portfolio {
  if (!canReadPortfolio(identity, kind)) throw new ManagerError('FORBIDDEN')
  const data = value as Portfolio
  const fail = () => { throw new ManagerError('UNAVAILABLE') }
  const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0
  const date = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v))
  const money = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0
  const rows = (v: unknown): v is { id: string }[] => Array.isArray(v) && v.every(row => row && text(row.id)) && new Set(v.map(row => row.id)).size === v.length
  const states = ['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED']
  const decisions = ['PENDING', 'RETURNED', 'APPROVED', 'REJECTED']
  if (!data || data.ownerId !== identity.id || data.kind !== kind || data.complete !== true || !date(data.generatedAt) || !rows(data.projects) || !rows(data.memberships) || !rows(data.users)) fail()
  if ((kind !== 'project-manager' && data.projects.length) || (kind !== 'member' && data.memberships.length) || (kind !== 'users' && data.users.length)) fail()
  const workIds = new Set<string>(); const attendanceIds = new Set<string>(); const allowanceIds = new Set<string>()
  for (const project of data.projects) {
    if (!canReadProject(identity, project.id) || !text(project.name) || !states.includes(project.state) || !date(project.startAt) || !date(project.endAt) || Date.parse(project.endAt) < Date.parse(project.startAt) || !money(project.availableMinor) || !rows(project.work) || !rows(project.allowances)) fail()
    for (const work of project.work) {
      if (workIds.has(work.id) || !text(work.title) || !states.includes(work.state) || !date(work.dueAt) || Date.parse(work.dueAt) < Date.parse(project.startAt) || Date.parse(work.dueAt) > Date.parse(project.endAt) || !Array.isArray(work.volunteerIds) || !work.volunteerIds.every(text) || new Set(work.volunteerIds).size !== work.volunteerIds.length || !rows(work.attendance)) fail()
      workIds.add(work.id)
      for (const item of work.attendance) { if (attendanceIds.has(item.id) || !['PENDING', 'VERIFIED', 'REJECTED'].includes(item.verification)) fail(); attendanceIds.add(item.id) }
    }
    for (const item of project.allowances) { if (allowanceIds.has(item.id) || !['DRAFT', 'SUBMITTED', 'VERIFIED', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED', 'RETURNED', 'CANCELLED'].includes(item.state) || !money(item.amountMinor) || item.amountMinor === 0 || !date(item.updatedAt)) fail(); allowanceIds.add(item.id) }
    if (!money(project.allowances.reduce((sum, row) => sum + row.amountMinor, 0))) fail()
  }
  if (!money(data.projects.reduce((sum, row) => sum + row.availableMinor, 0))) fail()
  const owners = new Set<string>(); const paymentIds = new Set<string>()
  for (const member of data.memberships) {
    if (!text(member.ownerId) || owners.has(member.ownerId) || !canReadMembership(identity, member.ownerId) || !text(member.name) || !['NOT_A_MEMBER', 'APPLIED', 'ACTIVE_MEMBER'].includes(member.status) || !(member.review === null || decisions.includes(member.review)) || !(member.category === null || text(member.category)) || !(member.duesMinor === null || money(member.duesMinor)) || !(member.expiresAt === null || date(member.expiresAt)) || typeof member.renewalEligible !== 'boolean' || !rows(member.history) || !rows(member.payments)) fail()
    owners.add(member.ownerId)
    for (const row of member.history) if (!decisions.includes(row.status) || !date(row.at) || typeof row.note !== 'string') fail()
    for (const row of member.payments) { if (paymentIds.has(row.id) || !money(row.amountMinor) || row.amountMinor === 0 || !['PENDING', 'SUCCESSFUL', 'FAILED', 'CANCELLED'].includes(row.state) || !date(row.at)) fail(); paymentIds.add(row.id) }
    if (!money(member.payments.reduce((sum, row) => sum + row.amountMinor, 0))) fail()
  }
  const emails = new Set<string>()
  if (!money(data.memberships.flatMap(row => row.payments).reduce((sum, row) => sum + row.amountMinor, 0))) fail()
  for (const user of data.users) {
    if (!text(user.name) || !text(user.email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email) || emails.has(user.email.toLowerCase()) || !['ACTIVE', 'PENDING', 'SUSPENDED', 'INACTIVE'].includes(user.state) || typeof user.mustChangePassword !== 'boolean' || !Array.isArray(user.grants)) fail()
    emails.add(user.email.toLowerCase()); const grants = new Set<string>()
    for (const grant of user.grants) {
      if (!grant || !roles.includes(grant.role) || !grant.scope || !['global', 'area', 'branch', 'project', 'supervision', 'self'].includes(grant.scope.kind) || !text(grant.scope.id) || !text(grant.scopeName) || (grant.scope.kind === 'self' && grant.scope.id !== user.id)) fail()
      const key = JSON.stringify([grant.role, grant.scope.kind, grant.scope.id]); if (grants.has(key)) fail(); grants.add(key)
    }
  }
  return data
}
export function filterDirectory(users: DirectoryUser[], query: string, state: string, role: string) {
  const term = query.trim().toLocaleLowerCase()
  return users.filter(user => (!state || user.state === state) && (!role || user.grants.some(grant => grant.role === role)) && (!term || [user.name, user.email, ...user.grants.map(grant => grant.scopeName)].some(value => value.toLocaleLowerCase().includes(term)))).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
}
