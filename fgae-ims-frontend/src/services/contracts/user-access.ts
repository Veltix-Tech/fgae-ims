import { roles, type Identity, type Role, type Scope } from './auth'
import { canReadPortfolio, mapPortfolio, type DirectoryUser } from './portfolio'
export type AccessScope = Scope & { name: string; roles: Role[] }
export type AccessAudit = { id: string; at: string; actor: string; actorId: string; action: 'CREATE' | 'UPDATE' | 'RESET'; reason: string; before: DirectoryUser | null; after: DirectoryUser }
export type AccessRecord = { user: DirectoryUser; version: number; history: AccessAudit[] }
export type AccessContext = { ownerId: string; record: AccessRecord | null; scopes: AccessScope[] }
export type AccessInput = { id?: string; version: number; name: string; email: string; state: DirectoryUser['state']; grants: { role: Role; scope: Scope }[]; reason: string; reset: boolean; idempotencyKey: string }
export type AccessResult = { ownerId: string; record: AccessRecord; temporaryPassword: string | null; replayed: boolean }
export const accessCodes = ['FORBIDDEN', 'SESSION_EXPIRED', 'NETWORK', 'UNAVAILABLE', 'INVALID_RESPONSE', 'VALIDATION', 'CONFLICT', 'EMAIL_IN_USE', 'LAST_ADMIN', 'NOT_FOUND', 'SELF_RESET', 'RATE_LIMITED', 'STORAGE_UNAVAILABLE'] as const
export class AccessError extends Error { constructor(public readonly code: typeof accessCodes[number]) { super(code) } }
export interface AccessService { load(id?: string, signal?: AbortSignal): Promise<{ identity: Identity; context: AccessContext }>; save(input: AccessInput, signal?: AbortSignal): Promise<AccessResult> }
export function canAdminUsers(identity: Identity) { return canReadPortfolio(identity, 'users') }
export const grantKey = (grant: { role: Role; scope: Scope }) => JSON.stringify([grant.role, grant.scope.kind, grant.scope.id])
export function validateAccess(input: AccessInput, scopes: AccessScope[]) {
  if ((!input.id && input.state !== 'ACTIVE') || !input.name.trim() || input.name.trim().length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) || input.email.length > 254 || !['ACTIVE', 'PENDING', 'SUSPENDED', 'INACTIVE'].includes(input.state) || !input.reason.trim() || input.reason.length > 1000 || !input.idempotencyKey || !Number.isSafeInteger(input.version) || input.version < 0 || !Array.isArray(input.grants) || (input.state === 'ACTIVE' && !input.grants.length) || (input.state === 'PENDING' && input.grants.length)) throw new AccessError('VALIDATION')
  if (new Set(input.grants.map(grantKey)).size !== input.grants.length) throw new AccessError('VALIDATION')
  for (const grant of input.grants) if (!roles.includes(grant.role) || !scopes.some(scope => scope.kind === grant.scope.kind && scope.id === grant.scope.id && scope.roles.includes(grant.role))) throw new AccessError('VALIDATION')
}
export function mapAccessContext(value: unknown, identity: Identity, id?: string): AccessContext {
  if (!canAdminUsers(identity)) throw new AccessError('FORBIDDEN')
  const data = value as AccessContext
  if (!data || data.ownerId !== identity.id || !Array.isArray(data.scopes) || data.scopes.some(scope => !scope || !['global','area','branch','project','supervision','self'].includes(scope.kind) || typeof scope.id !== 'string' || !scope.id || typeof scope.name !== 'string' || !scope.name || !Array.isArray(scope.roles) || !scope.roles.length || scope.roles.some(role => !roles.includes(role))) || new Set(data.scopes.map(scope => `${scope.kind}:${scope.id}`)).size !== data.scopes.length) throw new AccessError('INVALID_RESPONSE')
  if (id ? data.record?.user?.id !== id : data.record !== null) throw new AccessError('INVALID_RESPONSE')
  if (data.record) validateRecord(data.record, identity)
  return data
}
function validateRecord(record: AccessRecord, identity: Identity) {
  const validateUser = (user: DirectoryUser) => mapPortfolio({ ownerId: identity.id, kind: 'users', complete: true, generatedAt: new Date().toISOString(), projects: [], memberships: [], users: [user] }, identity, 'users')
  try {
    validateUser(record.user)
    if (!Number.isSafeInteger(record.version) || record.version < 1 || !Array.isArray(record.history)) throw new Error()
    const ids = new Set<string>()
    for (const row of record.history) {
      if (!row || typeof row.id !== 'string' || !row.id || ids.has(row.id) || !Number.isFinite(Date.parse(row.at)) || typeof row.actorId !== 'string' || !row.actorId || typeof row.actor !== 'string' || !row.actor.trim() || typeof row.reason !== 'string' || !row.reason.trim() || typeof row.at !== 'string' || !['CREATE','UPDATE','RESET'].includes(row.action) || row.after.id !== record.user.id || (row.before && row.before.id !== record.user.id)) throw new Error()
      ids.add(row.id); validateUser(row.after); if (row.before) validateUser(row.before)
    }
  } catch { throw new AccessError('INVALID_RESPONSE') }
}
export function mapAccessResult(value: unknown, identity: Identity, input: AccessInput): AccessResult {
  const data = value as AccessResult
  if (!data || data.ownerId !== identity.id || (input.id && data.record?.user?.id !== input.id) || typeof data.replayed !== 'boolean' || (data.temporaryPassword !== null && (typeof data.temporaryPassword !== 'string' || data.temporaryPassword.length < 12)) || (input.id && !input.reset && data.temporaryPassword !== null)) throw new AccessError('INVALID_RESPONSE')
  validateRecord(data.record, identity)
  const expectedGrants = input.grants.map(grant => grantKey({ ...grant, scope: { ...grant.scope, id: ['self','supervision'].includes(grant.scope.kind) && grant.scope.id === '@self' ? data.record.user.id : grant.scope.id } })).sort()
  const actualGrants = data.record.user.grants.map(grantKey).sort()
  if (data.record.user.state !== input.state || data.record.user.name !== input.name.trim() || JSON.stringify(expectedGrants) !== JSON.stringify(actualGrants) || (data.replayed && data.temporaryPassword !== null) || ((!input.id || input.reset) && !data.replayed && (!data.temporaryPassword || !data.record.user.mustChangePassword))) throw new AccessError('INVALID_RESPONSE')
  if (data.record.user.email.toLowerCase() !== input.email.toLowerCase() || data.record.version !== input.version + 1) throw new AccessError('INVALID_RESPONSE')
  return data
}
