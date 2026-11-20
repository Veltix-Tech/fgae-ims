import { authService, client } from './live-auth'
import { canReadPortfolio, mapPortfolio, type PortfolioService } from '../contracts/portfolio'
import { ManagerError } from '../contracts/manager-overview'
import { normalizeApiRole } from './auth-dto'
export function normalizePortfolioResponse(value: unknown): unknown {
  if (!value || typeof value !== 'object' || !('users' in value) || !Array.isArray(value.users)) return value
  return { ...value, users: value.users.map(user => !user || typeof user !== 'object' || !Array.isArray(user.grants) ? user : { ...user, grants: user.grants.map((grant: unknown) => !grant || typeof grant !== 'object' || !('role' in grant) ? grant : { ...grant, role: normalizeApiRole(grant.role) }) }) }
}
export const portfolioService: PortfolioService = {
  async load(kind, signal) {
    const identity = await authService.restore(signal)
    if (!identity) throw new ManagerError('SESSION_EXPIRED')
    if (!canReadPortfolio(identity, kind)) throw new ManagerError('FORBIDDEN')
    return { identity, overview: mapPortfolio(normalizePortfolioResponse(await client.portfolio(kind, signal)), identity, kind) }
  },
}
