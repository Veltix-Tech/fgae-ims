import type { Identity, Role, Scope } from '../services/contracts/auth'

// Role and scope stay paired; a role in one branch never expands another grant.
export function hasGrant(identity: Identity, role: Role, scope: Scope): boolean {
  if (identity.accountState !== 'ACTIVE' || identity.mustChangePassword) return false
  return identity.grants.some(grant => grant.role === 'SUPER_ADMIN' ||
    (grant.role === role && grant.scope.kind === scope.kind && grant.scope.id === scope.id))
}

export function nextJourney(identity: Identity): 'password-change' | 'application' | 'workspace' | 'no-access' {
  if (identity.mustChangePassword) return 'password-change'
  if (identity.accountState === 'PENDING') return 'application'
  return identity.grants.length ? 'workspace' : 'no-access'
}
