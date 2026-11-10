export const roles = ['SUPER_ADMIN', 'HR', 'AREA_MANAGER', 'BRANCH_MANAGER', 'VOLUNTEER_MANAGER',
  'FIELD_SUPERVISOR', 'FINANCE_OFFICER', 'VOLUNTEER', 'PROJECT_MANAGER', 'MEMBER'] as const
export type Role = typeof roles[number]
export type Scope = { kind: 'global' | 'area' | 'branch' | 'supervision' | 'project' | 'self'; id: string }
export interface RoleGrant { role: Role; scope: Scope }
export interface Identity {
  id: string; name: string; email: string; grants: RoleGrant[]
  accountState: 'ACTIVE' | 'PENDING'; mustChangePassword: boolean
}
export interface Credentials { email: string; password: string }
export type AuthErrorCode = 'INVALID_CREDENTIALS' | 'INACTIVE_ACCOUNT' | 'NETWORK' | 'UNAVAILABLE' |
  'RATE_LIMITED' | 'SESSION_EXPIRED' | 'INVALID_RESPONSE' | 'STORAGE_UNAVAILABLE'
export class AuthError extends Error {
  constructor(public readonly code: AuthErrorCode) { super(code); this.name = 'AuthError' }
}
export interface AuthService {
  signIn(credentials: Credentials, signal?: AbortSignal): Promise<Identity>
  restore(signal?: AbortSignal): Promise<Identity | null>
  signOut(): Promise<void>
}
