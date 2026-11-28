import { authService, client } from './live-auth'
import { AreaError, canReadAreas, canCreateArea } from '../contracts/areas'
import { mapFacilities, mapFacilityImpact, validateFacility, validateFacilityEdit, type FacilityService, type FacilityInput, type FacilityEditInput } from '../contracts/facilities'
async function guard(signal?: AbortSignal) {
  const identity = await authService.restore(signal)
  if (!identity) throw new AreaError('SESSION_EXPIRED')
  if (!canReadAreas(identity)) throw new AreaError('FORBIDDEN')
  return identity
}
async function save(input: FacilityInput | FacilityEditInput, editing: boolean, signal?: AbortSignal) {
  const identity = await guard(signal)
  if (!canCreateArea(identity)) throw new AreaError('FORBIDDEN')
  const next: FacilityInput & Partial<Pick<FacilityEditInput, 'id' | 'version' | 'state'>> = editing ? validateFacilityEdit(input as FacilityEditInput) : validateFacility(input)
  const data = await client.organization(next.id !== undefined ? `/facilities/${encodeURIComponent(next.id)}` : '/facilities', editing ? 'PUT' : 'POST', next, signal)
  const snapshot = mapFacilities(data.snapshot, identity); const f = snapshot.facilities.find(f => f.id === data.id); const audit = f?.history.at(-1)
  if (!f || next.id !== undefined && f.id !== next.id || f.version !== (next.version !== undefined ? next.version + 1 : 1) || f.name !== next.name || f.code !== next.code || f.address !== next.address || f.branchId !== next.branchId || f.state !== (next.state !== undefined ? next.state : 'ACTIVE') || audit?.actorId !== identity.id || audit.reason !== next.reason) throw new AreaError('INVALID_RESPONSE')
  if (editing ? audit.action === 'CREATE' || audit.after?.name !== f.name || audit.after?.code !== f.code || audit.after?.address !== f.address || audit.after?.branchId !== f.branchId || audit.after?.state !== f.state : f.history.length !== 1 || audit.action !== 'CREATE') throw new AreaError('INVALID_RESPONSE')
  const parent = snapshot.branches.find(b => b.id === f.branchId)!
  if (f.state === 'ACTIVE' && (parent.state !== 'ACTIVE' || !snapshot.areas.some(a => a.id === parent.areaId && a.state === 'ACTIVE'))) throw new AreaError('INVALID_RESPONSE')
  return {identity, snapshot, id: f.id}
}
export const facilityService: FacilityService = {
  async load(signal) { const identity = await guard(signal); return { identity, snapshot: mapFacilities(await client.organization('/facilities','GET',undefined,signal),identity) } },
  async impact(id,signal) { const identity = await guard(signal); if (!canCreateArea(identity)) throw new AreaError('FORBIDDEN'); return mapFacilityImpact(await client.organization(`/facilities/${encodeURIComponent(id)}/impact`,'GET',undefined,signal),identity,id) },
  create: (input,signal) => save(input,false,signal),
  update: (input,signal) => save(input,true,signal),
}
