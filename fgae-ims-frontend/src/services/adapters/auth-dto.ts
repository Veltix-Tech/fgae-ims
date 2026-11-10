import { AuthError, roles, type Identity, type Role, type RoleGrant, type Scope } from '../contracts/auth'

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AuthError('INVALID_RESPONSE')
  return value as Record<string, unknown>
}
function string(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new AuthError('INVALID_RESPONSE')
  return value
}
export function envelope(value: unknown): Record<string, unknown> {
  const body = record(value)
  if (body.success !== true) throw new AuthError('INVALID_RESPONSE')
  return record(body.data)
}
export function mapIdentity(value: unknown): Identity {
  const dto = record(value)
  if (!Array.isArray(dto.role_grants) || !['ACTIVE', 'PENDING'].includes(String(dto.account_status)) ||
      typeof dto.must_change_password !== 'boolean') throw new AuthError('INVALID_RESPONSE')
  const grants: RoleGrant[] = []
  for (const entry of dto.role_grants) {
    const grant = record(entry)
    const role = grant.role === 'SYSTEM_ADMIN' ? 'SUPER_ADMIN' : grant.role
    // Unknown roles never acquire capabilities. Backend identifiers need agreement (C-AUTH-01).
    if (!roles.includes(role as Role)) continue
    const scope = record(grant.scope)
    if (!['global', 'area', 'branch', 'supervision', 'project', 'self'].includes(String(scope.kind))) {
      throw new AuthError('INVALID_RESPONSE')
    }
    if (role === 'SUPER_ADMIN' && scope.kind !== 'global') throw new AuthError('INVALID_RESPONSE')
    grants.push({ role: role as Role, scope: { kind: scope.kind as Scope['kind'], id: string(scope.id) } })
  }
  return { id: string(dto.id), name: string(dto.display_name), email: string(dto.email), grants,
    accountState: dto.account_status as Identity['accountState'], mustChangePassword: dto.must_change_password }
}
