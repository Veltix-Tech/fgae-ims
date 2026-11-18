import type { Identity, Role } from './auth'
export const managerKinds = ['area-manager', 'branch-manager', 'volunteer-manager'] as const
export type ManagerKind = typeof managerKinds[number]
export interface WorkLocation { id: string; name: string; kind: 'area' | 'branch'; areaId: string }
export interface WorkRow {
  id: string; title: string; locationId: string; state: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  dueAt: string; target: number; assigned: number; attendancePending: number; needsAllocation: boolean; needsSupervisor: boolean
}
export interface VolunteerRow { id: string; name: string; locationId: string; state: 'ACTIVE' | 'INACTIVE'; updatedAt: string }
export interface ApplicationRow { id: string; name: string; locationId: string; state: 'PENDING' | 'RETURNED' | 'APPROVED' | 'REJECTED'; updatedAt: string }
export interface ManagerOverview {
  ownerId: string; kind: ManagerKind; generatedAt: string; locations: WorkLocation[]
  counts: { work: number; active: number; allocation: number; unfilled: number; supervision: number; attendance: number; volunteers: number; inactiveVolunteers: number; pending: number; returned: number; applications: number }
  work: WorkRow[]; volunteers: VolunteerRow[]; applications: ApplicationRow[]
}
export interface ManagerSnapshot { identity: Identity; overview: ManagerOverview }
export interface ManagerOverviewService { load(kind: ManagerKind, signal?: AbortSignal): Promise<ManagerSnapshot> }
export class ManagerError extends Error { constructor(public readonly code: 'SESSION_EXPIRED' | 'FORBIDDEN' | 'UNAVAILABLE') { super(code); this.name = 'ManagerError' } }
export const managerRoles: Record<ManagerKind, Role> = { 'area-manager': 'AREA_MANAGER', 'branch-manager': 'BRANCH_MANAGER', 'volunteer-manager': 'VOLUNTEER_MANAGER' }
function permittedScope(kind: ManagerKind, scope: string) { return kind === 'area-manager' ? scope === 'area' : kind === 'branch-manager' ? scope === 'branch' : ['global', 'area', 'branch'].includes(scope) }
export function canReadManager(identity: Identity, kind: ManagerKind) {
  return identity.accountState === 'ACTIVE' && !identity.mustChangePassword && identity.grants.some(grant => (grant.role === 'SUPER_ADMIN' && grant.scope.kind === 'global') || (grant.role === managerRoles[kind] && permittedScope(kind, grant.scope.kind)))
}
export function canReadLocation(identity: Identity, kind: ManagerKind, location: WorkLocation) {
  if (!canReadManager(identity, kind) || (kind !== 'area-manager' && location.kind !== 'branch')) return false
  return identity.grants.some(grant => (grant.role === 'SUPER_ADMIN' && grant.scope.kind === 'global') || (grant.role === managerRoles[kind] && permittedScope(kind, grant.scope.kind) && (grant.scope.kind === 'global' || (grant.scope.kind === 'area' && grant.scope.id === location.areaId) || (grant.scope.kind === 'branch' && location.kind === 'branch' && grant.scope.id === location.id))))
}
export function mapManagerOverview(value: unknown, identity: Identity, kind: ManagerKind): ManagerOverview {
  if (!canReadManager(identity, kind)) throw new ManagerError('FORBIDDEN')
  const data = value as ManagerOverview
  const text = (value: unknown) => typeof value === 'string' && value.trim().length > 0
  const date = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value))
  const count = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0
  if (!data || data.ownerId !== identity.id || data.kind !== kind || !date(data.generatedAt) || !Array.isArray(data.locations) || !data.counts || !Array.isArray(data.work) || !Array.isArray(data.volunteers) || !Array.isArray(data.applications)) throw new ManagerError('UNAVAILABLE')
  const ids = new Set<string>()
  for (const location of data.locations) {
    if (!location || !text(location.id) || !text(location.name) || !text(location.areaId) || !['area', 'branch'].includes(location.kind) || (location.kind === 'area' && location.id !== location.areaId) || ids.has(location.id) || !canReadLocation(identity, kind, location)) throw new ManagerError('UNAVAILABLE')
    ids.add(location.id)
  }
  const keys = ['work', 'active', 'allocation', 'unfilled', 'supervision', 'attendance', 'volunteers', 'inactiveVolunteers', 'pending', 'returned', 'applications'] as const
  if (!keys.every(key => count(data.counts[key])) || (data.counts.active > data.counts.work || data.counts.allocation > data.counts.work || data.counts.supervision > data.counts.work)) throw new ManagerError('UNAVAILABLE')
  const validRows = (rows: { id: string; locationId: string }[]) => rows.length <= 6 && new Set(rows.map(row => row?.id)).size === rows.length && rows.every(row => row && text(row.id) && ids.has(row.locationId))
  if (![data.work, data.volunteers, data.applications].every(validRows)) throw new ManagerError('UNAVAILABLE')
  for (const row of data.work) if (!text(row.title) || !['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED'].includes(row.state) || !date(row.dueAt) || !count(row.target) || !count(row.assigned) || row.assigned > row.target || !count(row.attendancePending) || typeof row.needsAllocation !== 'boolean' || typeof row.needsSupervisor !== 'boolean' || (kind === 'branch-manager' && data.locations.find(location => location.id === row.locationId)?.kind !== 'branch')) throw new ManagerError('UNAVAILABLE')
  for (const row of data.volunteers) if (!text(row.name) || !['ACTIVE', 'INACTIVE'].includes(row.state) || !date(row.updatedAt) || data.locations.find(location => location.id === row.locationId)?.kind !== 'branch') throw new ManagerError('UNAVAILABLE')
  for (const row of data.applications) if (!text(row.name) || !['PENDING', 'RETURNED', 'APPROVED', 'REJECTED'].includes(row.state) || !date(row.updatedAt) || data.locations.find(location => location.id === row.locationId)?.kind !== 'branch') throw new ManagerError('UNAVAILABLE')
  if ((kind !== 'volunteer-manager' && (data.applications.length || data.counts.applications || data.counts.pending || data.counts.returned))) throw new ManagerError('UNAVAILABLE')
  if (data.applications.length !== Math.min(6, data.counts.applications) || data.counts.pending + data.counts.returned > data.counts.applications || data.work.length !== Math.min(6, data.counts.work) || data.volunteers.length !== Math.min(6, data.counts.volunteers + data.counts.inactiveVolunteers) || data.applications.filter(row => row.state === 'PENDING').length > data.counts.pending || data.applications.filter(row => row.state === 'RETURNED').length > data.counts.returned || data.volunteers.filter(row => row.state === 'ACTIVE').length > data.counts.volunteers || data.volunteers.filter(row => row.state === 'INACTIVE').length > data.counts.inactiveVolunteers || (!ids.size && keys.some(key => data.counts[key] > 0))) throw new ManagerError('UNAVAILABLE')
  const current = data.work.filter(row => !['COMPLETED', 'CANCELLED'].includes(row.state))
  if (data.work.filter(row => row.state === 'ACTIVE').length > data.counts.active || current.filter(row => row.needsAllocation).length > data.counts.allocation || current.filter(row => row.needsSupervisor).length > data.counts.supervision || current.reduce((sum, row) => sum + row.target - row.assigned, 0) > data.counts.unfilled || data.work.reduce((sum, row) => sum + row.attendancePending, 0) > data.counts.attendance || data.work.some(row => data.locations.find(location => location.id === row.locationId)?.kind !== (kind === 'area-manager' ? 'area' : 'branch') || (kind !== 'area-manager' && row.needsAllocation) || (['COMPLETED', 'CANCELLED'].includes(row.state) && (row.needsAllocation || row.needsSupervisor)))) throw new ManagerError('UNAVAILABLE')
  return { ...data,
    work: [...data.work].sort((a, b) => Number(['COMPLETED', 'CANCELLED'].includes(a.state)) - Number(['COMPLETED', 'CANCELLED'].includes(b.state)) || Date.parse(a.dueAt) - Date.parse(b.dueAt)),
    volunteers: [...data.volunteers].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    applications: [...data.applications].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
  }
}
