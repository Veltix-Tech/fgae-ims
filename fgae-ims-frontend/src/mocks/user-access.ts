import { storedAreas } from './areas'
import { authService } from './auth'
import { directoryUsers } from './portfolio'
import { accessRecord, mutateAccess } from './credentials'
import { workLocations } from './operations'
import { AccessError, canAdminUsers, mapAccessContext, mapAccessResult, type AccessScope, type AccessService } from '../services/contracts/user-access'
async function guard(signal?: AbortSignal) { const identity = await authService.restore(signal); if (!identity) throw new AccessError('SESSION_EXPIRED'); if (!canAdminUsers(identity)) throw new AccessError('FORBIDDEN'); return identity }
export function accessScopes(id = '@self'): AccessScope[] {
  return [{ kind: 'global', id: '*', name: 'Organization-wide', roles: ['SUPER_ADMIN','HR','FINANCE_OFFICER'] },
    ...storedAreas().filter(a => a.state === 'ACTIVE').map(a => ({ kind: 'area' as const, id: a.id, name: a.name, roles: ['AREA_MANAGER','HR','VOLUNTEER_MANAGER','FINANCE_OFFICER'] as AccessScope['roles'] })),
    ...workLocations.map(row => ({ kind: row.kind, id: row.id, name: row.name, roles: (row.kind === 'area' ? ['AREA_MANAGER','HR','VOLUNTEER_MANAGER','FINANCE_OFFICER'] : ['BRANCH_MANAGER','HR','VOLUNTEER_MANAGER','FINANCE_OFFICER']) as AccessScope['roles'] })),
    { kind: 'project', id: 'fictional-project-a', name: 'Demo community outreach project', roles: ['PROJECT_MANAGER','FINANCE_OFFICER'] }, { kind: 'project', id: 'fictional-project-b', name: 'Outside project', roles: ['PROJECT_MANAGER','FINANCE_OFFICER'] },
    { kind: 'self', id, name: 'Own records', roles: ['VOLUNTEER','MEMBER'] }, { kind: 'supervision', id, name: 'Own supervision', roles: ['FIELD_SUPERVISOR'] }]
}
export const accessService: AccessService = {
  async load(id, signal) {
    const identity = await guard(signal); const user = id ? directoryUsers().find(row => row.id === id) : null
    if (id && !user) throw new AccessError('NOT_FOUND')
    const stored = id ? accessRecord(id) : null
    const record = user ? { ...(stored ?? { version: 1, history: [] }), user } : null
    return { identity, context: mapAccessContext({ ownerId: identity.id, record, scopes: accessScopes(id) }, identity, id) }
  },
  async save(input, signal) { const identity = await guard(signal); return mapAccessResult(await mutateAccess(input, accessScopes(input.id), directoryUsers, () => guard(signal), signal), identity, input) },
}
