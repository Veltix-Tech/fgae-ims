import { authService } from './auth'
import { branchService } from './branches'
import { assignments, attendance, allocations } from './operations'
import { organizationAreas, organizationBranches, organizationFacilities, readOrganization, writeOrganization, lockedOrganization } from './organization-store'
import { AreaError, canCreateArea, canReadAreas } from '../services/contracts/areas'
import { facilityValues, mapFacilities, validateFacility, validateFacilityEdit, type Facility, type FacilityService, type FacilityInput, type FacilityEditInput, type FacilityImpact } from '../services/contracts/facilities'
async function guard(signal?: AbortSignal) {
  const identity = await authService.restore(signal); signal?.throwIfAborted()
  if (!identity) throw new AreaError('SESSION_EXPIRED')
  if (!canReadAreas(identity)) throw new AreaError('FORBIDDEN')
  return identity
}
function impactFor(id: string, ownerId: string): FacilityImpact {
  const facility = organizationFacilities().find(f => f.id === id)
  if (!facility) throw new AreaError('NOT_FOUND')
  const linked = assignments.filter(a => a.facilityId === id)
  const records = attendance.filter(a => linked.some(w => w.id === a.assignmentId))
  return { ownerId, facilityId: id, version: facility.version,
    activeAssignments: linked.filter(a => !['COMPLETED','CANCELLED'].includes(allocations.find(w => w.id === a.workId)?.state ?? 'ACTIVE')).length,
    pendingAttendance: records.filter(a => a.state === 'PENDING').length, linkedRecords: linked.length + records.length }
}
async function save(input: FacilityInput | FacilityEditInput, editing: boolean, signal?: AbortSignal) {
  return lockedOrganization(async () => {
    const identity = await guard(signal)
    if (!canCreateArea(identity)) throw new AreaError('FORBIDDEN')
    const next: FacilityInput & Partial<Pick<FacilityEditInput, 'id' | 'version' | 'state'>> = editing ? validateFacilityEdit(input as FacilityEditInput) : validateFacility(input)
    const data = readOrganization(); const payload = JSON.stringify({kind: editing ? 'facility-edit' : 'facility', ...next})
    const receipt = data.receipts[next.idempotencyKey]
    if (receipt) {
      if (receipt.actor !== identity.id || receipt.payload !== payload) throw new AreaError('CONFLICT')
      return { identity, id: receipt.id, snapshot: mapFacilities(receipt.snapshot, identity) }
    }
    const all = organizationFacilities(data)
    const old = next.id !== undefined ? all.find(f => f.id === next.id) : undefined
    if (editing && !old) throw new AreaError('NOT_FOUND')
    if (old && next.version !== undefined && old.version !== next.version) throw new AreaError('CONFLICT')
    const state = next.state !== undefined ? next.state : 'ACTIVE'
    const parent = organizationBranches(data).find(b => b.id === next.branchId)
    const activeParent = parent?.state === 'ACTIVE' && organizationAreas(data).some(a => a.id === parent.areaId && a.state === 'ACTIVE')
    if (!parent || !activeParent && (!old || state === 'ACTIVE' || next.branchId !== old.branchId)) throw new AreaError('IMPACT_BLOCKED')
    if (all.some(f => f.id !== old?.id && (f.code === next.code || f.branchId === next.branchId && f.name.toLocaleLowerCase() === next.name.toLocaleLowerCase()))) throw new AreaError('DUPLICATE')
    const moving = !!old && old.branchId !== next.branchId
    if (old) {
      const impact = impactFor(old.id, identity.id)
      if (moving && (impact.linkedRecords > 0 || state !== old.state) || old.state === 'ACTIVE' && state === 'ARCHIVED' && (impact.activeAssignments > 0 || impact.pendingAttendance > 0)) throw new AreaError('IMPACT_BLOCKED')
    }
    const id = old?.id ?? `synthetic-facility-${crypto.randomUUID()}`; const at = new Date().toISOString()
    const after = facilityValues({...next, state})
    const record: Facility = { ...after, id, version: (old?.version ?? 0) + 1, createdAt: old?.createdAt ?? at,
      history: [...(old?.history ?? []), { id: crypto.randomUUID(), actorId: identity.id, actor: identity.name, at, reason: next.reason,
        action: !old ? 'CREATE' : moving ? 'MOVE' : state === old.state ? 'UPDATE' : state === 'ARCHIVED' ? 'ARCHIVE' : 'RESTORE', ...(old ? { before: facilityValues(old), after } : {}) }] }
    const current = await guard(signal)
    if (current.id !== identity.id || !canCreateArea(current)) throw new AreaError('FORBIDDEN')
    data.facilities = [...(data.facilities ?? []).filter(f => f.id !== id), record]
    const snapshot = mapFacilities({ ownerId: identity.id, areas: organizationAreas(data), branches: organizationBranches(data), facilities: organizationFacilities(data) }, identity)
    data.receipts[next.idempotencyKey] = { actor: identity.id, payload, id, snapshot }
    signal?.throwIfAborted(); writeOrganization(data)
    return { identity, snapshot, id }
  })
}
export const facilityService: FacilityService = {
  async load(signal) { const loaded = await branchService.load(signal); signal?.throwIfAborted(); return { identity: loaded.identity, snapshot: mapFacilities({...loaded.snapshot, facilities: organizationFacilities().filter(f => loaded.snapshot.branches.some(b => b.id === f.branchId))}, loaded.identity) } },
  async impact(id, signal) { const identity = await guard(signal); if (!canCreateArea(identity)) throw new AreaError('FORBIDDEN'); return impactFor(id, identity.id) },
  create: (input, signal) => save(input, false, signal),
  update: (input, signal) => save(input, true, signal),
}
