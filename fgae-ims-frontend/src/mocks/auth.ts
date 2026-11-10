import { accounts } from './identities'
import { credentialRevision, verifyCredential } from './credentials'
import { AuthError, type AuthService } from '../services/contracts/auth'

const SESSION_KEY = 'fgae.synthetic.auth.v1'
const TTL = 15 * 60 * 1000
function read(): { version: 1; email: string; expiresAt: number; credentialRevision?: number } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Record<string, unknown>
    if (value.version !== 1 || typeof value.email !== 'string' || typeof value.expiresAt !== 'number') {
      sessionStorage.removeItem(SESSION_KEY); return null
    }
    return value as { version: 1; email: string; expiresAt: number; credentialRevision?: number }
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
    const revision = credentialRevision(credentials.email.toLowerCase())
    if (!await verifyCredential(credentials.email, credentials.password) || revision !== credentialRevision(credentials.email.toLowerCase())) throw new AuthError('INVALID_CREDENTIALS')
    if (credentials.email === 'inactive@example.test') throw new AuthError('INACTIVE_ACCOUNT')
    const account = accounts.find(a => a.email === credentials.email.toLowerCase())
    if (!account) throw new AuthError('INVALID_CREDENTIALS')
    check(signal)
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ version: 1, email: account.email, expiresAt: Date.now() + TTL, credentialRevision: credentialRevision(account.email) })) }
    catch { throw new AuthError('STORAGE_UNAVAILABLE') }
    return { ...structuredClone(account), mustChangePassword: account.mustChangePassword && credentialRevision(account.email) === 0 }
  },
  async restore(signal) {
    // Let an abandoned mount cancel before consuming the expired-session notice.
    await Promise.resolve()
    check(signal)
    const saved = read()
    if (!saved) return null
    if (saved.expiresAt <= Date.now() || (saved.credentialRevision ?? 0) !== credentialRevision(saved.email)) { sessionStorage.removeItem(SESSION_KEY); throw new AuthError('SESSION_EXPIRED') }
    const account = accounts.find(a => a.email === saved.email)
    return account ? { ...structuredClone(account), mustChangePassword: account.mustChangePassword && credentialRevision(account.email) === 0 } : null
  },
  async signOut() {
    try { sessionStorage.removeItem(SESSION_KEY) } catch { throw new AuthError('STORAGE_UNAVAILABLE') }
  },
}
