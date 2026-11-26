import type { Facility } from '../services/contracts/facilities'
import { AreaError, type Area, type AreaSnapshot } from '../services/contracts/areas'
import type { Branch } from '../services/contracts/branches'
import type { WorkLocation } from '../services/contracts/manager-overview'
export const organizationKey = 'fgae.synthetic.areas.v1'
export const baseLocations: WorkLocation[] = [
 {id:'fictional-area-a',areaId:'fictional-area-a',kind:'area',name:'Demo area A'}, {id:'fictional-area-b',areaId:'fictional-area-b',kind:'area',name:'Demo area B'},
 {id:'fictional-branch-a',areaId:'fictional-area-a',kind:'branch',name:'Demo branch A'}, {id:'fictional-branch-b',areaId:'fictional-area-b',kind:'branch',name:'Demo branch B'},
]
export interface OrganizationStore {areas:Area[];branches?:Branch[];receipts:Record<string,{actor:string;payload:string;id:string;snapshot?:AreaSnapshot}>}
export function readOrganization():OrganizationStore { try { const raw = localStorage.getItem(organizationKey); if (!raw) return {areas:[],branches:[],receipts:{}}; const d = JSON.parse(raw) as OrganizationStore; if (!Array.isArray(d.areas) || !d.receipts || typeof d.receipts !== 'object' || d.branches !== undefined && !Array.isArray(d.branches)) throw new Error(); return d } catch { throw new AreaError('STORAGE_UNAVAILABLE') } }
export function writeOrganization(data:OrganizationStore) { try {localStorage.setItem(organizationKey,JSON.stringify(data))} catch {throw new AreaError('STORAGE_UNAVAILABLE')} }
export function organizationAreas(data = readOrganization()):Area[] { const seeds:Area[] = baseLocations.filter(l => l.kind === 'area').map((l,i) => ({id:l.id,name:l.name,code:`DEMO-${i+1}`,description:'',state:'ACTIVE',version:1,createdAt:'2026-11-09T09:00:00Z',history:[]})); return [...new Map([...seeds,...data.areas].map(a => [a.id,a])).values()] }
export function organizationBranches(data = readOrganization()):Branch[] { const seeds:Branch[] = baseLocations.filter(l => l.kind === 'branch').map((l,i) => ({id:l.id,areaId:l.areaId,name:l.name,code:`BR-${i+1}`,description:'',state:'ACTIVE',version:1,createdAt:'2026-11-09T09:00:00Z',history:[]})); return [...new Map([...seeds,...(data.branches ?? [])].map(b => [b.id,b])).values()] }
export function readWorkLocations():WorkLocation[] { return [...organizationAreas().map(a => ({id:a.id,areaId:a.id,name:a.name,kind:'area' as const})),...organizationBranches().map(b => ({id:b.id,areaId:b.areaId,name:b.name,kind:'branch' as const}))] }
let queue = Promise.resolve()
export function lockedOrganization<T>(fn:()=>Promise<T>) { if (navigator.locks) return navigator.locks.request(organizationKey,fn); const next = queue.then(fn,fn); queue = next.then(()=>undefined,()=>undefined);return next }

export function organizationFacilities():Facility[] {return [
 {id:'synthetic-facility-a1',branchId:'fictional-branch-a',code:'FAC-A1',name:'Demo service point A',address:'Demo branch A compound',state:'ACTIVE'},
 {id:'synthetic-facility-a2',branchId:'fictional-branch-a',code:'FAC-A2',name:'Demo youth center A',address:'Demo community site A',state:'ACTIVE'},
 {id:'synthetic-facility-a3',branchId:'fictional-branch-a',code:'FAC-A3',name:'Demo former service point A',address:'',state:'ARCHIVED'},
 {id:'synthetic-facility-b1',branchId:'fictional-branch-b',code:'FAC-B1',name:'Demo service point B',address:'Demo branch B compound',state:'ACTIVE'},
]}
