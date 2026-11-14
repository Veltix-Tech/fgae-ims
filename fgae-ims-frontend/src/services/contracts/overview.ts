import type { Identity } from './auth'
export const applicationStates = ['PENDING', 'RETURNED', 'APPROVED', 'REJECTED'] as const
export type ApplicationState = typeof applicationStates[number]
export interface OverviewRecord { id: string; name: string; branch: string; status: ApplicationState; updatedAt: string }
export interface Overview {
  ownerId: string; scope: 'global'; generatedAt: string
  counts: Record<ApplicationState, number>; recent: OverviewRecord[]
}
export interface OverviewSnapshot { identity: Identity; overview: Overview }
export interface OverviewService { load(signal?: AbortSignal): Promise<OverviewSnapshot> }
export class OverviewError extends Error { constructor(public readonly code: 'FORBIDDEN' | 'SESSION_EXPIRED' | 'UNAVAILABLE') { super(code); this.name = 'OverviewError' } }
export function canReadOverview(identity: Identity) {
  return identity.accountState === 'ACTIVE' && !identity.mustChangePassword && identity.grants.some(grant => grant.role === 'SUPER_ADMIN' && grant.scope.kind === 'global')
}
export function mapOverview(value: unknown, ownerId: string): Overview {
  const data = value as Overview
  const date = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value))
  const text = (value: unknown) => typeof value === 'string' && value.trim().length > 0
  if (!data || data.ownerId !== ownerId || data.scope !== 'global' || !date(data.generatedAt) || !data.counts || !applicationStates.every(state => Number.isSafeInteger(data.counts[state]) && data.counts[state] >= 0) || !Array.isArray(data.recent) || data.recent.length > 6) throw new OverviewError('UNAVAILABLE')
  const ids = new Set<string>()
  for (const item of data.recent) {
    if (!item || !text(item.id) || !text(item.name) || !text(item.branch) || !applicationStates.includes(item.status) || !date(item.updatedAt) || ids.has(item.id)) throw new OverviewError('UNAVAILABLE')
    ids.add(item.id)
  }
  if (!Number.isSafeInteger(Object.values(data.counts).reduce((sum, value) => sum + value, 0)) || applicationStates.some(state => data.recent.filter(item => item.status === state).length > data.counts[state])) throw new OverviewError('UNAVAILABLE')
  return { ...data, recent: [...data.recent].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)) }
}
