import {authService,client} from './live-auth'
import {AreaError,canReadAreas} from '../contracts/areas'
import {mapFacilities,type FacilityService} from '../contracts/facilities'
export const facilityService:FacilityService={async load(signal){const identity=await authService.restore(signal);if(!identity)throw new AreaError('SESSION_EXPIRED');if(!canReadAreas(identity))throw new AreaError('FORBIDDEN');return {identity,snapshot:mapFacilities(await client.organization('/facilities','GET',undefined,signal),identity)}}}
