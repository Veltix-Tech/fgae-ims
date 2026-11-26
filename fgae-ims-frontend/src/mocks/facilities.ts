import {branchService} from './branches'
import {organizationFacilities} from './organization-store'
import {mapFacilities,type FacilityService} from '../services/contracts/facilities'
export const facilityService:FacilityService={async load(signal){const loaded=await branchService.load(signal);signal?.throwIfAborted();return {identity:loaded.identity,snapshot:mapFacilities({...loaded.snapshot,facilities:organizationFacilities().filter(f=>loaded.snapshot.branches.some(b=>b.id===f.branchId))},loaded.identity)}}}
