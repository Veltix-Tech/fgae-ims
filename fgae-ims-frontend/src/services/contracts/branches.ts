import type { Identity } from './auth'
import { AreaError, canReadAreas, mapAreas, validateArea, type Area, type AreaBranch, type AreaInput } from './areas'
export interface Branch extends AreaBranch { code: string; description: string; createdAt: string; version: number; history: {id:string; actorId:string; actor:string; at:string; reason:string; action:'CREATE'}[] }
export interface BranchInput extends AreaInput { areaId: string }
export interface BranchSnapshot { ownerId: string; areas: Area[]; branches: Branch[] }
export interface BranchService { load(signal?: AbortSignal): Promise<{identity:Identity;snapshot:BranchSnapshot}>; create(input:BranchInput,signal?:AbortSignal):Promise<{identity:Identity;snapshot:BranchSnapshot;id:string}> }
export function validateBranch(input:BranchInput) { const next = validateArea(input); if (!input.areaId?.trim()) throw new AreaError('VALIDATION'); return {...next,areaId:input.areaId} }
export function mapBranches(value:unknown,identity:Identity): BranchSnapshot {
 const d = value as BranchSnapshot; if (!canReadAreas(identity)) throw new AreaError('FORBIDDEN'); mapAreas(d,identity); const codes = new Set<string>()
 for (const b of d.branches) { if (b.name.trim().length < 2 || b.name.length > 120 || typeof b.code !== 'string' || !/^[A-Z0-9][A-Z0-9-]{1,19}$/.test(b.code) || codes.has(b.code) || typeof b.description !== 'string' || b.description.length > 1000 || !Number.isSafeInteger(b.version) || b.version < 1 || typeof b.createdAt !== 'string' || !Number.isFinite(Date.parse(b.createdAt)) || !Array.isArray(b.history)) throw new AreaError('INVALID_RESPONSE'); codes.add(b.code)
 const ids = new Set<string>(); for (const h of b.history) { if (!h || typeof h.id !== 'string' || !h.id || ids.has(h.id) || typeof h.actorId !== 'string' || !h.actorId || typeof h.actor !== 'string' || !h.actor || typeof h.at !== 'string' || !Number.isFinite(Date.parse(h.at)) || typeof h.reason !== 'string' || !h.reason || h.action !== 'CREATE') throw new AreaError('INVALID_RESPONSE'); ids.add(h.id) }
 }
 return d
}
