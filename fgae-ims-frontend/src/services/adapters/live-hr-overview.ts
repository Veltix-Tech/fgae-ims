import { authService, client } from './live-auth'
import { canReadHr, HrError, mapHrOverview, type HrOverviewService } from '../contracts/hr-overview'
export const hrOverviewService: HrOverviewService = {
  async load(signal) {
    const identity = await authService.restore(signal)
    if (!identity) throw new HrError('SESSION_EXPIRED')
    if (!canReadHr(identity)) throw new HrError('FORBIDDEN')
    return { identity, overview: mapHrOverview(await client.hrOverview(signal), identity) }
  },
}
