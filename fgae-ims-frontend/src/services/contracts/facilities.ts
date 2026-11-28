import type { Identity } from './auth'
import { AreaError, canCreateArea, validateArea } from './areas'
import { mapBranches, type BranchSnapshot } from './branches'

export interface FacilityValues { branchId: string; code: string; name: string; address: string; state: 'ACTIVE' | 'ARCHIVED' }
export interface Facility extends FacilityValues {
  id: string; version: number; createdAt: string
  history: { id: string; actorId: string; actor: string; at: string; reason: string; action: 'CREATE' | 'UPDATE' | 'ARCHIVE' | 'RESTORE' | 'MOVE'; before?: FacilityValues; after?: FacilityValues }[]
}
export interface FacilitySnapshot extends BranchSnapshot { facilities: Facility[] }
export interface FacilityInput { branchId: string; code: string; name: string; address: string; reason: string; idempotencyKey: string }
export interface FacilityEditInput extends FacilityInput { id: string; version: number; state: 'ACTIVE' | 'ARCHIVED' }
export interface FacilityImpact { ownerId: string; facilityId: string; version: number; activeAssignments: number; pendingAttendance: number; linkedRecords: number }
export interface FacilityResult { identity: Identity; snapshot: FacilitySnapshot; id: string }
export interface FacilityService {
  load(signal?: AbortSignal): Promise<{ identity: Identity; snapshot: FacilitySnapshot }>
  create(input: FacilityInput, signal?: AbortSignal): Promise<FacilityResult>
  update(input: FacilityEditInput, signal?: AbortSignal): Promise<FacilityResult>
  impact(id: string, signal?: AbortSignal): Promise<FacilityImpact>
}
const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim()
const date = (v: unknown) => text(v) && Number.isFinite(Date.parse(v))
export function facilityValues(f: FacilityValues): FacilityValues { return { name: f.name, code: f.code, address: f.address, branchId: f.branchId, state: f.state } }
function validValues(value: unknown): value is FacilityValues {
  const v = value as FacilityValues
  return !!v && text(v.branchId) && text(v.name) && v.name.trim().length >= 2 && v.name.length <= 120 && typeof v.code === 'string' && /^[A-Z0-9][A-Z0-9-]{1,19}$/.test(v.code) && typeof v.address === 'string' && v.address.length <= 300 && ['ACTIVE','ARCHIVED'].includes(v.state)
}
export function validateFacility(input: FacilityInput): FacilityInput {
  const base = validateArea({ ...input, description: '' })
  if (!text(input.branchId) || typeof input.address !== 'string' || input.address.trim().length > 300) throw new AreaError('VALIDATION')
  return { name: base.name, code: base.code, address: input.address.trim(), branchId: input.branchId, reason: base.reason, idempotencyKey: base.idempotencyKey }
}
export function validateFacilityEdit(input: FacilityEditInput): FacilityEditInput {
  const base = validateFacility(input)
  if (!text(input.id) || !Number.isSafeInteger(input.version) || input.version < 1 || !['ACTIVE','ARCHIVED'].includes(input.state)) throw new AreaError('VALIDATION')
  return { ...base, id: input.id, version: input.version, state: input.state }
}
export function mapFacilities(value: unknown, identity: Identity): FacilitySnapshot {
  const d = value as FacilitySnapshot; mapBranches(d, identity)
  if (!Array.isArray(d.facilities)) throw new AreaError('INVALID_RESPONSE')
  const ids = new Set<string>(); const codes = new Set<string>()
  for (const f of d.facilities) {
    if (!validValues(f) || !text(f.id) || ids.has(f.id) || codes.has(f.code) || !d.branches.some(b => b.id === f.branchId) || !Number.isSafeInteger(f.version) || f.version < 1 || !date(f.createdAt) || !Array.isArray(f.history)) throw new AreaError('INVALID_RESPONSE')
    ids.add(f.id); codes.add(f.code)
    const audits = new Set<string>()
    for (const h of f.history) {
      if (!h || !text(h.id) || audits.has(h.id) || !text(h.actorId) || !text(h.actor) || !date(h.at) || !text(h.reason) || !['CREATE','UPDATE','ARCHIVE','RESTORE','MOVE'].includes(h.action) || h.action !== 'CREATE' && (!validValues(h.before) || !validValues(h.after))) throw new AreaError('INVALID_RESPONSE')
      if (h.action === 'UPDATE' && (h.before?.branchId !== h.after?.branchId || h.before?.state !== h.after?.state) || h.action === 'MOVE' && (h.before?.branchId === h.after?.branchId || h.before?.state !== h.after?.state) || h.action === 'ARCHIVE' && (h.before?.state !== 'ACTIVE' || h.after?.state !== 'ARCHIVED' || h.before?.branchId !== h.after?.branchId) || h.action === 'RESTORE' && (h.before?.state !== 'ARCHIVED' || h.after?.state !== 'ACTIVE' || h.before?.branchId !== h.after?.branchId)) throw new AreaError('INVALID_RESPONSE')
      audits.add(h.id)
    }
  }
  return d
}
export function mapFacilityImpact(value: unknown, identity: Identity, id: string): FacilityImpact {
  const d = value as FacilityImpact
  if (!canCreateArea(identity) || !d || d.ownerId !== identity.id || d.facilityId !== id || !Number.isSafeInteger(d.version) || d.version < 1 || ![d.activeAssignments,d.pendingAttendance,d.linkedRecords].every(n => Number.isSafeInteger(n) && n >= 0) || d.activeAssignments > d.linkedRecords || d.pendingAttendance > d.linkedRecords) throw new AreaError('INVALID_RESPONSE')
  return d
}
