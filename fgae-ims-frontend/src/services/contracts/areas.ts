import type { Identity } from './auth'
export interface Area { id: string; code: string; name: string; description: string; state: 'ACTIVE' | 'ARCHIVED'; version: number; createdAt: string; history: { id: string; actorId: string; actor: string; at: string; reason: string; action: 'CREATE' }[] }
export interface AreaBranch { id: string; areaId: string; name: string; state: 'ACTIVE' | 'ARCHIVED' }
export interface AreaSnapshot { ownerId: string; areas: Area[]; branches: AreaBranch[] }
export interface AreaInput { code: string; name: string; description: string; reason: string; idempotencyKey: string }
export interface AreaService { load(signal?: AbortSignal): Promise<{ identity: Identity; snapshot: AreaSnapshot }>; create(input: AreaInput, signal?: AbortSignal): Promise<{ identity: Identity; snapshot: AreaSnapshot; id: string }> }
export const areaCodes = ['FORBIDDEN','SESSION_EXPIRED','NETWORK','UNAVAILABLE','INVALID_RESPONSE','VALIDATION','DUPLICATE','CONFLICT','STORAGE_UNAVAILABLE','RATE_LIMITED'] as const
export class AreaError extends Error { constructor(public readonly code: typeof areaCodes[number]) { super(code); this.name = 'AreaError' } }
const ready = (i: Identity) => i.accountState === 'ACTIVE' && !i.mustChangePassword
export const canCreateArea = (i: Identity) => ready(i) && i.grants.some(g => g.role === 'SUPER_ADMIN' && g.scope.kind === 'global' && g.scope.id === '*')
export const canReadAreas = (i: Identity) => canCreateArea(i) || ready(i) && i.grants.some(g => g.role === 'AREA_MANAGER' && g.scope.kind === 'area' || g.role === 'BRANCH_MANAGER' && g.scope.kind === 'branch' || g.role === 'VOLUNTEER_MANAGER' && ['area','branch','global'].includes(g.scope.kind) && (g.scope.kind !== 'global' || g.scope.id === '*'))
export const canReadAreaBranch = (i: Identity, b: AreaBranch) => canCreateArea(i) || ready(i) && i.grants.some(g => (g.role === 'AREA_MANAGER' || g.role === 'VOLUNTEER_MANAGER') && g.scope.kind === 'area' && g.scope.id === b.areaId || (g.role === 'BRANCH_MANAGER' || g.role === 'VOLUNTEER_MANAGER') && g.scope.kind === 'branch' && g.scope.id === b.id || g.role === 'VOLUNTEER_MANAGER' && g.scope.kind === 'global' && g.scope.id === '*')
export const canReadArea = (i: Identity, id: string, branches: AreaBranch[]) => canCreateArea(i) || ready(i) && (i.grants.some(g => (g.role === 'AREA_MANAGER' || g.role === 'VOLUNTEER_MANAGER') && g.scope.kind === 'area' && g.scope.id === id || g.role === 'VOLUNTEER_MANAGER' && g.scope.kind === 'global' && g.scope.id === '*') || branches.some(b => b.areaId === id && canReadAreaBranch(i,b)))
export function normalizeArea(input: AreaInput): AreaInput { return { ...input, code: input.code.trim().toUpperCase(), name: input.name.trim(), description: input.description.trim(), reason: input.reason.trim() } }
export function validateArea(input: AreaInput) { const i = normalizeArea(input); if (!/^[A-Z0-9][A-Z0-9-]{1,19}$/.test(i.code) || i.name.length < 2 || i.name.length > 120 || i.description.length > 1000 || i.reason.length < 5 || i.reason.length > 500 || !i.idempotencyKey || i.idempotencyKey.length > 100) throw new AreaError('VALIDATION'); return i }
const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim()
const date = (v: unknown) => text(v) && Number.isFinite(Date.parse(v))
export function mapAreas(value: unknown, identity: Identity): AreaSnapshot {
  const d = value as AreaSnapshot
  const fail = () => { throw new AreaError('INVALID_RESPONSE') }
  if (!canReadAreas(identity) || !d || d.ownerId !== identity.id || !Array.isArray(d.areas) || !Array.isArray(d.branches)) return fail()
  const ids = new Set<string>(); const codes = new Set<string>(); const branchIds = new Set<string>()
  for (const a of d.areas) {
    if (!a || !text(a.id) || !text(a.name) || a.name.trim().length < 2 || a.name.length > 120 || typeof a.description !== 'string' || a.description.length > 1000 || !text(a.code) || !/^[A-Z0-9][A-Z0-9-]{1,19}$/.test(a.code) || ids.has(a.id) || codes.has(a.code) || !['ACTIVE','ARCHIVED'].includes(a.state) || !Number.isSafeInteger(a.version) || a.version < 1 || !date(a.createdAt) || !Array.isArray(a.history)) return fail()
    ids.add(a.id); codes.add(a.code)
    const auditIds = new Set<string>()
    for (const h of a.history) { if (!h || !text(h.id) || auditIds.has(h.id) || !text(h.actorId) || !text(h.actor) || !date(h.at) || !text(h.reason) || h.action !== 'CREATE') return fail(); auditIds.add(h.id) }
  }
  for (const b of d.branches) { if (!b || !text(b.id) || branchIds.has(b.id) || !ids.has(b.areaId) || !text(b.name) || !['ACTIVE','ARCHIVED'].includes(b.state) || !canReadAreaBranch(identity,b)) return fail(); branchIds.add(b.id) }
  if (d.areas.some(a => !canReadArea(identity,a.id,d.branches))) return fail()
  return d
}
