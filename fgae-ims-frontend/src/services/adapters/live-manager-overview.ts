import { authService, client } from './live-auth'
import { canReadManager, ManagerError, mapManagerOverview, type ManagerOverviewService } from '../contracts/manager-overview'
export const managerOverviewService: ManagerOverviewService = {
  async load(kind, signal) {
    const identity = await authService.restore(signal)
    if (!identity) throw new ManagerError('SESSION_EXPIRED')
    if (!canReadManager(identity, kind)) throw new ManagerError('FORBIDDEN')
    return { identity, overview: mapManagerOverview(await client.managerOverview(kind, signal), identity, kind) }
  },
}
