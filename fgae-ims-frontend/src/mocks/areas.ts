import { authService } from './auth'
import { workLocations } from './operations'
import { AreaError, canCreateArea, canReadAreas, canReadArea, canReadAreaBranch, mapAreas, validateArea, type Area, type AreaBranch, type AreaInput, type AreaService } from '../services/contracts/areas'
const STORE = 'fgae.synthetic.areas.v1'
interface Store { areas: Area[]; receipts: Record<string, { actor: string; payload: string; id: string }> }
export function storedAreas(): Area[] { return read().areas }
function read(): Store { try { const raw = localStorage.getItem(STORE); if (!raw) return { areas: [], receipts: {} }; const data = JSON.parse(raw) as Store; if (!Array.isArray(data.areas) || !data.receipts || typeof data.receipts !== 'object') throw new Error(); return data } catch { throw new AreaError('STORAGE_UNAVAILABLE') } }
const branches: AreaBranch[] = workLocations.filter(l => l.kind === 'branch').map(l => ({ id: l.id, areaId: l.areaId, name: l.name, state: 'ACTIVE' }))
const seeds: Area[] = workLocations.filter(l => l.kind === 'area').map((l,index) => ({ id: l.id, name: l.name, code: `DEMO-${index + 1}`, description: '', state: 'ACTIVE', version: 1, createdAt: '2026-11-09T09:00:00Z', history: [] }))
async function guard(signal?: AbortSignal) { const i = await authService.restore(signal); signal?.throwIfAborted(); if (!i) throw new AreaError('SESSION_EXPIRED'); if (!canReadAreas(i)) throw new AreaError('FORBIDDEN'); return i }
let queue = Promise.resolve()
function locked<T>(fn: () => Promise<T>) { if (navigator.locks) return navigator.locks.request(STORE, fn); const next = queue.then(fn,fn); queue = next.then(() => undefined, () => undefined); return next }
export const areaService: AreaService = {
  async load(signal) { const identity = await guard(signal); const visibleBranches = branches.filter(b => canReadAreaBranch(identity,b)); return { identity, snapshot: mapAreas({ ownerId: identity.id, areas: [...seeds,...read().areas].filter(a => canReadArea(identity,a.id,visibleBranches)), branches: visibleBranches }, identity) } },
  async create(input: AreaInput, signal) { return locked(async () => {
    const identity = await guard(signal); if (!canCreateArea(identity)) throw new AreaError('FORBIDDEN')
    const data = read(); const next = validateArea(input); const payload = JSON.stringify(next); const receipt = data.receipts[next.idempotencyKey]
    if (receipt) { if (receipt.actor !== identity.id || receipt.payload !== payload) throw new AreaError('CONFLICT'); return { ...await areaService.load(signal), id: receipt.id } }
    if ([...seeds,...data.areas].some(a => a.code === next.code || a.name.toLocaleLowerCase() === next.name.toLocaleLowerCase())) throw new AreaError('DUPLICATE')
    const id = `synthetic-area-${crypto.randomUUID()}`; const at = new Date().toISOString()
    const area: Area = { id, code: next.code, name: next.name, description: next.description, state: 'ACTIVE', version: 1, createdAt: at, history: [{ id: crypto.randomUUID(), actorId: identity.id, actor: identity.name, at, reason: next.reason, action: 'CREATE' }] }
    const current = await guard(signal); if (current.id !== identity.id || !canCreateArea(current)) throw new AreaError('FORBIDDEN')
    data.areas.push(area); data.receipts[next.idempotencyKey] = { actor: identity.id, payload, id }
    signal?.throwIfAborted(); try { localStorage.setItem(STORE, JSON.stringify(data)) } catch { throw new AreaError('STORAGE_UNAVAILABLE') }
    return { ...await areaService.load(signal), id }
  }) },
}
