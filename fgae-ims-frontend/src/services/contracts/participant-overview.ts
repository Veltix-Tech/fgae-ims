import type { Identity, Role } from './auth'
import { ManagerError } from './manager-overview'
export const participantKinds = ['field-supervisor', 'finance-officer', 'volunteer'] as const
export type ParticipantKind = typeof participantKinds[number]
export const participantRoles: Record<ParticipantKind, Role> = { 'field-supervisor': 'FIELD_SUPERVISOR', 'finance-officer': 'FINANCE_OFFICER', volunteer: 'VOLUNTEER' }
export interface Placement { branchId: string; areaId: string; projectId: string }
export interface AssignmentSummary extends Placement { id: string; title: string; place: string; volunteerId: string; volunteerName: string; supervisorId: string | null; startAt: string; endAt: string; state: 'ACTIVE' | 'ENDED' | 'CANCELLED' }
export interface AttendanceSummary { id: string; assignmentId: string; date: string; attendance: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'; verification: 'PENDING' | 'VERIFIED' | 'REJECTED'; evidence: boolean }
export interface AllowanceSummary extends Placement { id: string; title: string; volunteerId: string; supervisorId: string; createdBy: string; approvedBy: string | null; amountMinor: number | null; state: 'DRAFT' | 'SUBMITTED' | 'VERIFIED' | 'APPROVED' | 'PROCESSING' | 'PAID' | 'FAILED' | 'RETURNED' | 'CANCELLED'; updatedAt: string }
export interface PaymentSummary extends Placement { id: string; title: string; payerId: string; amountMinor: number; state: 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'CANCELLED'; updatedAt: string }
export interface BudgetSummary extends Placement { id: string; title: string; availableMinor: number }
// Complete scoped snapshots: UI truncates lists only after deriving totals from all rows.
export interface ParticipantOverview { ownerId: string; kind: ParticipantKind; generatedAt: string; complete: true; capabilities: { approve: boolean; disburse: boolean }; assignments: AssignmentSummary[]; attendance: AttendanceSummary[]; allowances: AllowanceSummary[]; payments: PaymentSummary[]; budgets: BudgetSummary[] }
export interface ParticipantSnapshot { identity: Identity; overview: ParticipantOverview }
export interface ParticipantOverviewService { load(kind: ParticipantKind, signal?: AbortSignal): Promise<ParticipantSnapshot> }
export const isGlobalAdmin = (identity: Identity) => identity.grants.some(grant => grant.role === 'SUPER_ADMIN' && grant.scope.kind === 'global')
export function canReadParticipant(identity: Identity, kind: ParticipantKind) {
  return identity.accountState === 'ACTIVE' && !identity.mustChangePassword && (isGlobalAdmin(identity) || identity.grants.some(grant => grant.role === participantRoles[kind] && (kind === 'volunteer' ? grant.scope.kind === 'self' && grant.scope.id === identity.id : kind === 'field-supervisor' ? grant.scope.kind === 'supervision' : ['global', 'area', 'branch', 'project'].includes(grant.scope.kind))))
}
export function canReadParticipantRow(identity: Identity, kind: ParticipantKind, row: Placement & { volunteerId?: string; supervisorId?: string | null; payerId?: string }) {
  return canReadParticipant(identity, kind) && (isGlobalAdmin(identity) || identity.grants.some(grant => grant.role === participantRoles[kind] && (kind === 'volunteer' ? grant.scope.kind === 'self' && grant.scope.id === identity.id && (row.volunteerId ?? row.payerId) === identity.id : kind === 'field-supervisor' ? grant.scope.kind === 'supervision' && grant.scope.id === row.supervisorId : grant.scope.kind === 'global' || (grant.scope.kind === 'area' && grant.scope.id === row.areaId) || (grant.scope.kind === 'branch' && grant.scope.id === row.branchId) || (grant.scope.kind === 'project' && grant.scope.id === row.projectId))))
}
export function financeEligible(identity: Identity, data: ParticipantOverview, row: AllowanceSummary, action: 'approve' | 'disburse') {
  return data.kind === 'finance-officer' && canReadParticipantRow(identity, data.kind, row) && data.capabilities[action] && (action === 'approve' ? row.state === 'VERIFIED' && (isGlobalAdmin(identity) || row.createdBy !== identity.id) : row.state === 'APPROVED' && (isGlobalAdmin(identity) || row.approvedBy !== identity.id))
}
export function mapParticipantOverview(value: unknown, identity: Identity, kind: ParticipantKind): ParticipantOverview {
  if (!canReadParticipant(identity, kind)) throw new ManagerError('FORBIDDEN')
  const data = value as ParticipantOverview
  const fail = () => { throw new ManagerError('UNAVAILABLE') }
  const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0
  const date = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v))
  const day = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v
  const money = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0
  if (!data || data.ownerId !== identity.id || data.kind !== kind || data.complete !== true || !date(data.generatedAt) || !data.capabilities || typeof data.capabilities.approve !== 'boolean' || typeof data.capabilities.disburse !== 'boolean') fail()
  for (const rows of [data.assignments, data.attendance, data.allowances, data.payments, data.budgets]) if (!Array.isArray(rows) || rows.some(row => !row || !text(row.id)) || new Set(rows.map(row => row.id)).size !== rows.length) fail()
  if (kind !== 'finance-officer' && (data.capabilities.approve || data.capabilities.disburse || data.budgets.length)) fail()
  if (kind === 'finance-officer' && (data.assignments.length || data.attendance.length)) fail()
  if (kind === 'field-supervisor' && data.payments.length) fail()
  const placement = (row: Placement) => text(row.branchId) && text(row.areaId) && text(row.projectId)
  for (const row of data.assignments) if (!placement(row) || !text(row.title) || !text(row.place) || !text(row.volunteerId) || !text(row.volunteerName) || !(row.supervisorId === null || text(row.supervisorId)) || !date(row.startAt) || !date(row.endAt) || Date.parse(row.endAt) < Date.parse(row.startAt) || !['ACTIVE', 'ENDED', 'CANCELLED'].includes(row.state) || !canReadParticipantRow(identity, kind, row)) fail()
  for (const row of data.attendance) if (!data.assignments.some(assignment => assignment.id === row.assignmentId) || !day(row.date) || !['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].includes(row.attendance) || !['PENDING', 'VERIFIED', 'REJECTED'].includes(row.verification) || typeof row.evidence !== 'boolean') fail()
  if (new Set(data.attendance.map(row => JSON.stringify([row.assignmentId, row.date]))).size !== data.attendance.length) fail()
  for (const row of data.allowances) if (!placement(row) || !text(row.title) || !text(row.volunteerId) || !text(row.supervisorId) || !text(row.createdBy) || !(row.approvedBy === null || text(row.approvedBy)) || !date(row.updatedAt) || !['DRAFT', 'SUBMITTED', 'VERIFIED', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED', 'RETURNED', 'CANCELLED'].includes(row.state) || (kind === 'field-supervisor' ? row.amountMinor !== null : !money(row.amountMinor) || row.amountMinor === 0) || !canReadParticipantRow(identity, kind, row) || (['APPROVED', 'PROCESSING', 'PAID', 'FAILED'].includes(row.state) && row.approvedBy === null)) fail()
  for (const row of data.payments) if (!placement(row) || !text(row.title) || !text(row.payerId) || !money(row.amountMinor) || row.amountMinor === 0 || !['PENDING', 'SUCCESSFUL', 'FAILED', 'CANCELLED'].includes(row.state) || !date(row.updatedAt) || !canReadParticipantRow(identity, kind, row)) fail()
  for (const row of data.budgets) if (!placement(row) || !text(row.title) || !money(row.availableMinor) || !canReadParticipantRow(identity, kind, row)) fail()
  for (const sum of [data.payments.reduce((total, row) => total + row.amountMinor, 0), data.allowances.reduce((total, row) => total + (row.amountMinor ?? 0), 0), data.budgets.reduce((total, row) => total + row.availableMinor, 0)]) if (!money(sum)) fail()
  return data
}
