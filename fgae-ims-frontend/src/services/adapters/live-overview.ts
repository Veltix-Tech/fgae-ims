import { authService, client } from './live-auth'
import { canReadOverview, mapOverview, OverviewError, type OverviewService } from '../contracts/overview'
export const overviewService: OverviewService = {
  async load(signal) {
    const identity = await authService.restore(signal)
    if (!identity) throw new OverviewError('SESSION_EXPIRED')
    if (!canReadOverview(identity)) throw new OverviewError('FORBIDDEN')
    return { identity, overview: mapOverview(await client.adminOverview(signal), identity.id) }
  },
}
