import { authService, client } from './live-auth'
import { AccessError, canAdminUsers, mapAccessContext, mapAccessResult, type AccessService } from '../contracts/user-access'
async function guard(signal?: AbortSignal) { const identity = await authService.restore(signal); if (!identity) throw new AccessError('SESSION_EXPIRED'); if (!canAdminUsers(identity)) throw new AccessError('FORBIDDEN'); return identity }
export const accessService: AccessService = {
  async load(id, signal) { const identity = await guard(signal); return { identity, context: mapAccessContext(await client.userAccess(id ? `/users/${encodeURIComponent(id)}` : '/users/create-context', 'GET', undefined, signal), identity, id) } },
  async save(input, signal) { const identity = await guard(signal); return mapAccessResult(await client.userAccess(input.id ? `/users/${encodeURIComponent(input.id)}/access` : '/users', input.id ? 'PUT' : 'POST', input, signal), identity, input) },
}
