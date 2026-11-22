import { authService, client } from './live-auth'
import { AreaError, canCreateArea, canReadAreas, mapAreas, validateArea, type AreaService } from '../contracts/areas'
async function guard(signal?: AbortSignal) { const identity = await authService.restore(signal); if (!identity) throw new AreaError('SESSION_EXPIRED'); if (!canReadAreas(identity)) throw new AreaError('FORBIDDEN'); return identity }
export const areaService: AreaService = {
  async load(signal) { const identity = await guard(signal); return { identity, snapshot: mapAreas(await client.areas(undefined,signal),identity) } },
  async create(input, signal) { const identity = await guard(signal); if (!canCreateArea(identity)) throw new AreaError('FORBIDDEN'); const next = validateArea(input); const data = await client.areas(next,signal); const snapshot = mapAreas(data.snapshot,identity); const area = snapshot.areas.find(a => a.id === data.id); if (!area || area.code !== next.code || area.name !== next.name || area.description !== next.description || area.state !== 'ACTIVE' || area.version !== 1 || area.history.length !== 1 || area.history[0]?.reason !== next.reason || area.history[0]?.actorId !== identity.id) throw new AreaError('INVALID_RESPONSE'); return { identity, snapshot, id: area.id } },
}
