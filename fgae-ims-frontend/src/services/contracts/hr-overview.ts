import type { Identity } from './auth'
export interface HrBranch { id: string; areaId: string; name: string }
export interface PersonnelSummary {
  id: string; name: string; branchId: string; jobTitle: string; updatedAt: string
  employment: 'ACTIVE' | 'ON_LEAVE' | 'ENDED'; account: 'ACTIVE' | 'SUSPENDED' | 'NONE'
  needsContact: boolean; needsJob: boolean
}
export interface HrOverview {
  ownerId: string; generatedAt: string; branches: HrBranch[]
  counts: { total: number; active: number; onLeave: number; ended: number; needsContact: number; needsJob: number }
  recent: PersonnelSummary[]
}
export interface HrSnapshot { identity: Identity; overview: HrOverview }
export interface HrOverviewService { load(signal?: AbortSignal): Promise<HrSnapshot> }
export class HrError extends Error { constructor(public readonly code: 'FORBIDDEN' | 'SESSION_EXPIRED' | 'UNAVAILABLE') { super(code); this.name = 'HrError' } }
export function canReadHr(identity: Identity) {
  return identity.accountState === 'ACTIVE' && !identity.mustChangePassword && identity.grants.some(grant =>
    (grant.role === 'SUPER_ADMIN' && grant.scope.kind === 'global') || (grant.role === 'HR' && ['global', 'area', 'branch'].includes(grant.scope.kind)))
}
export function canReadHrBranch(identity: Identity, branch: HrBranch) {
  return canReadHr(identity) && identity.grants.some(grant =>
    (grant.role === 'SUPER_ADMIN' && grant.scope.kind === 'global') || (grant.role === 'HR' && (grant.scope.kind === 'global' || (grant.scope.kind === 'branch' && grant.scope.id === branch.id) || (grant.scope.kind === 'area' && grant.scope.id === branch.areaId))))
}
export function mapHrOverview(value: unknown, identity: Identity): HrOverview {
  if (!canReadHr(identity)) throw new HrError('FORBIDDEN')
  const data = value as HrOverview
  const text = (value: unknown) => typeof value === 'string' && value.trim().length > 0
  const date = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value))
  if (!data || data.ownerId !== identity.id || !date(data.generatedAt) || !Array.isArray(data.branches) || !data.counts || !Array.isArray(data.recent) || data.recent.length > 6) throw new HrError('UNAVAILABLE')
  const branches = new Set<string>()
  for (const branch of data.branches) {
    if (!branch || !text(branch.id) || !text(branch.areaId) || !text(branch.name) || branches.has(branch.id) || !canReadHrBranch(identity, branch)) throw new HrError('UNAVAILABLE')
    branches.add(branch.id)
  }
  const counts = data.counts
  if (!(['total', 'active', 'onLeave', 'ended', 'needsContact', 'needsJob'] as const).every(key => Number.isSafeInteger(counts[key]) && counts[key] >= 0 && counts[key] <= counts.total) || counts.active + counts.onLeave + counts.ended !== counts.total || (!branches.size && counts.total > 0)) throw new HrError('UNAVAILABLE')
  const ids = new Set<string>()
  for (const person of data.recent) {
    if (!person || !text(person.id) || !text(person.name) || !branches.has(person.branchId) || typeof person.jobTitle !== 'string' || !date(person.updatedAt) || !['ACTIVE', 'ON_LEAVE', 'ENDED'].includes(person.employment) || !['ACTIVE', 'SUSPENDED', 'NONE'].includes(person.account) || typeof person.needsContact !== 'boolean' || typeof person.needsJob !== 'boolean' || ids.has(person.id)) throw new HrError('UNAVAILABLE')
    ids.add(person.id)
  }
  if (data.recent.length !== Math.min(6, counts.total) || data.recent.filter(item => item.needsContact).length > counts.needsContact || data.recent.filter(item => item.needsJob).length > counts.needsJob || data.recent.filter(item => item.employment === 'ACTIVE').length > counts.active || data.recent.filter(item => item.employment === 'ON_LEAVE').length > counts.onLeave || data.recent.filter(item => item.employment === 'ENDED').length > counts.ended) throw new HrError('UNAVAILABLE')
  return { ...data, recent: [...data.recent].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)) }
}
