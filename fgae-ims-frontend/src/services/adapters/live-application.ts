import { authService, client } from './live-auth'
import { ApplicationError, canReadOwnApplication, mapOwnApplication, type ApplicationService } from '../contracts/application'

export const applicationService: ApplicationService = {
  async own(signal) {
    const identity = await authService.restore(signal)
    if (!identity) throw new ApplicationError('SESSION_EXPIRED')
    if (!canReadOwnApplication(identity)) throw new ApplicationError('FORBIDDEN')
    const data = await client.ownApplication(signal)
    return { identity, application: mapOwnApplication(data.application, identity.id) }
  },
}
