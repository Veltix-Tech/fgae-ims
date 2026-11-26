import type {Identity} from './auth'
import {AreaError} from './areas'
import {mapBranches,type BranchSnapshot} from './branches'
export interface Facility {id:string;branchId:string;code:string;name:string;address:string;state:'ACTIVE'|'ARCHIVED'}
export interface FacilitySnapshot extends BranchSnapshot {facilities:Facility[]}
export interface FacilityService {load(signal?:AbortSignal):Promise<{identity:Identity;snapshot:FacilitySnapshot}>}
export function mapFacilities(value:unknown,identity:Identity):FacilitySnapshot {const d=value as FacilitySnapshot;mapBranches(d,identity);if(!Array.isArray(d.facilities))throw new AreaError('INVALID_RESPONSE');const ids=new Set<string>();const codes=new Set<string>();for(const f of d.facilities){if(!f||typeof f.id!=='string'||!f.id||ids.has(f.id)||typeof f.code!=='string'||!/^[A-Z0-9][A-Z0-9-]{1,19}$/.test(f.code)||codes.has(f.code)||typeof f.name!=='string'||f.name.trim().length<2||f.name.length>120||typeof f.address!=='string'||f.address.length>300||!['ACTIVE','ARCHIVED'].includes(f.state)||!d.branches.some(b=>b.id===f.branchId))throw new AreaError('INVALID_RESPONSE');ids.add(f.id);codes.add(f.code)}return d}
