import { authService, client } from './live-auth'
import { canReadParticipant, mapParticipantOverview, type ParticipantOverviewService } from '../contracts/participant-overview'
import { ManagerError } from '../contracts/manager-overview'
export const participantOverviewService: ParticipantOverviewService = {
  async load(kind, signal) {
    const identity = await authService.restore(signal)
    if (!identity) throw new ManagerError('SESSION_EXPIRED')
    if (!canReadParticipant(identity, kind)) throw new ManagerError('FORBIDDEN')
    return { identity, overview: mapParticipantOverview(await client.participantOverview(kind, signal), identity, kind) }
  },
}
