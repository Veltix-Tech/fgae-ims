import { AuthError, roles, type AuthService, type Identity, type Role, type Scope } from '../services/contracts/auth'

const SESSION_KEY = 'fgae.synthetic.auth.v1'
const TTL = 15 * 60 * 1000
const scopeFor = (role: Role, id: string): Scope => role === 'SUPER_ADMIN' ? { kind: 'global', id: '*' } :
  role === 'AREA_MANAGER' ? { kind: 'area', id: 'fictional-area-a' } :
  role === 'FIELD_SUPERVISOR' ? { kind: 'supervision', id } :
  role === 'PROJECT_MANAGER' ? { kind: 'project', id: 'fictional-project-a' } :
  role === 'VOLUNTEER' || role === 'MEMBER' ? { kind: 'self', id } : { kind: 'branch', id: 'fictional-branch-a' }
const accounts: Identity[] = roles.map((role, index) => ({
  id: `fictional-person-${index}`, name: `Demo ${index + 1}`, email: `${role.toLowerCase().replaceAll('_', '.')}@example.test`,
  grants: [{ role, scope: scopeFor(role, `fictional-person-${index}`) }], accountState: 'ACTIVE', mustChangePassword: false,
}))
accounts.push(
  { id: 'fictional-applicant', name: 'Demo Applicant', email: 'pending@example.test', grants: [], accountState: 'PENDING', mustChangePassword: false },
  { ...accounts[7]!, id: 'fictional-first-login', email: 'first.login@example.test', mustChangePassword: true },
  { ...accounts[7]!, email: 'multi.role@example.test', grants: [...accounts[7]!.grants, { role: 'MEMBER', scope: scopeFor('MEMBER', accounts[7]!.id) }] },
)
function read(): { version: 1; email: string; expiresAt: number } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Record<string, unknown>
    if (value.version !== 1 || typeof value.email !== 'string' || typeof value.expiresAt !== 'number') {
      sessionStorage.removeItem(SESSION_KEY); return null
    }
    return value as { version: 1; email: string; expiresAt: number }
  } catch (error) {
    if (error instanceof SyntaxError) { sessionStorage.removeItem(SESSION_KEY); return null }
    throw new AuthError('STORAGE_UNAVAILABLE')
  }
}
function check(signal?: AbortSignal) {
  signal?.throwIfAborted()
  if (!navigator.onLine) throw new AuthError('NETWORK')
}
export const authService: AuthService = {
  async signIn(credentials, signal) {
    check(signal)
    // This credential is synthetic-only and excluded by the live adapter build alias.
    if (credentials.password !== 'Demo-only-2026!') throw new AuthError('INVALID_CREDENTIALS')
    if (credentials.email === 'inactive@example.test') throw new AuthError('INACTIVE_ACCOUNT')
    const account = accounts.find(a => a.email === credentials.email.toLowerCase())
    if (!account) throw new AuthError('INVALID_CREDENTIALS')
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ version: 1, email: account.email, expiresAt: Date.now() + TTL })) }
    catch { throw new AuthError('STORAGE_UNAVAILABLE') }
    return structuredClone(account)
  },
  async restore(signal) {
    // Let an abandoned mount cancel before consuming the expired-session notice.
    await Promise.resolve()
    check(signal)
    const saved = read()
    if (!saved) return null
    if (saved.expiresAt <= Date.now()) { sessionStorage.removeItem(SESSION_KEY); throw new AuthError('SESSION_EXPIRED') }
    const account = accounts.find(a => a.email === saved.email)
    return account ? structuredClone(account) : null
  },
  async signOut() {
    try { sessionStorage.removeItem(SESSION_KEY) } catch { throw new AuthError('STORAGE_UNAVAILABLE') }
  },
}
