import { ResetError, validNewPassword, type ResetRequest } from '../services/contracts/reset-password'
import { accounts } from './identities'
import { FirstLoginError, type FirstLoginInput } from '../services/contracts/first-login'

const STORE = 'fgae.synthetic.credentials.v1'
const INITIAL_PASSWORD = 'Demo-only-2026!'
type Credential = { salt: string; digest: string; revision: number; firstLogin?: { key: string; digest: string; previousRevision: number } }
type Link = { token: string; email: string; expiresAt: number; usedAt?: number; completionKey?: string; completionDigest?: string }
type State = { version: 1; credentials: Record<string, Credential>; links: Link[] }
function read(): State {
  try {
    const raw = localStorage.getItem(STORE)
    if (!raw) return { version: 1, credentials: {}, links: [] }
    const state = JSON.parse(raw) as State
    if (state.version !== 1 || !state.credentials || !Array.isArray(state.links)) throw new Error('Invalid schema')
    return state
  } catch { throw new ResetError('STORAGE_UNAVAILABLE') }
}
function write(state: State) {
  try { localStorage.setItem(STORE, JSON.stringify(state)) } catch { throw new ResetError('STORAGE_UNAVAILABLE') }
}
let queue = Promise.resolve()
async function locked<T>(operation: () => Promise<T>): Promise<T> {
  // One atomic synthetic mutation across tabs. This is not a substitute for a backend transaction.
  if (navigator.locks) return navigator.locks.request(STORE, operation)
  const result = queue.then(operation, operation)
  queue = result.then(() => undefined, () => undefined)
  return result
}
async function digest(value: string, salt: string) {
  // Synthetic-only verifier; production password hashing must be performed by the backend.
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${value}`))
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
}
export function credentialRevision(email: string) { return read().credentials[email.toLowerCase()]?.revision ?? 0 }
export async function verifyCredential(email: string, password: string) {
  const credential = read().credentials[email.toLowerCase()]
  return credential ? await digest(password, credential.salt) === credential.digest : password === INITIAL_PASSWORD
}
export async function issueRecoveryLink(email: string, requestKey: string) {
  return locked(async () => {
    const account = accounts.find(item => item.email === email.toLowerCase())
    // The public request returns the same response even when no synthetic delivery is created.
    if (!account) return
    const state = read()
    const token = `synthetic-reset-${requestKey}`
    if (state.links.some(link => link.token === token)) return
    state.links = [...state.links.slice(-39), { token, email: account.email, expiresAt: Date.now() + 15 * 60_000 }]
    write(state)
  })
}
async function ensureReviewLink(token: string) {
  if (!['demo-reset-volunteer', 'demo-reset-expired', 'demo-reset-used'].includes(token)) return
  await locked(async () => {
    const state = read()
    if (state.links.some(link => link.token === token)) return
    state.links.push({ token, email: 'volunteer@example.test',
      expiresAt: token === 'demo-reset-expired' ? Date.now() - 1 : Date.now() + 15 * 60_000,
      ...(token === 'demo-reset-used' ? { usedAt: Date.now() } : {}) })
    write(state)
  })
}
function activeLink(state: State, token: string) {
  const link = state.links.find(item => item.token === token)
  if (!link) throw new ResetError('INVALID_LINK')
  if (link.usedAt) throw new ResetError('USED_LINK')
  if (link.expiresAt <= Date.now()) throw new ResetError('EXPIRED_LINK')
  return link
}
export async function validateRecoveryLink(token: string, signal?: AbortSignal) {
  signal?.throwIfAborted()
  await ensureReviewLink(token)
  signal?.throwIfAborted()
  return { expiresAt: activeLink(read(), token).expiresAt }
}
export async function completeRecovery(input: ResetRequest, signal?: AbortSignal) {
  if (!validNewPassword(input.password)) throw new ResetError('PASSWORD_REJECTED')
  if (input.password !== input.confirmation) throw new ResetError('CONFIRMATION_MISMATCH')
  return locked(async () => {
    signal?.throwIfAborted()
    const state = read()
    const existing = state.links.find(link => link.token === input.token)
    if (existing?.usedAt && existing.completionKey === input.idempotencyKey &&
        existing.completionDigest === await digest(input.password, input.idempotencyKey)) return
    const link = activeLink(state, input.token)
    if (await verifyCredential(link.email, input.password)) throw new ResetError('SAME_PASSWORD')
    const salt = crypto.randomUUID()
    const credential = { salt, digest: await digest(input.password, salt), revision: (state.credentials[link.email]?.revision ?? 0) + 1 }
    const completionDigest = await digest(input.password, input.idempotencyKey)
    signal?.throwIfAborted()
    state.credentials[link.email] = credential
    // Consume every outstanding link for this account and invalidate older sessions in the same write.
    state.links = state.links.map(item => item.email === link.email && !item.usedAt ? { ...item, usedAt: Date.now(),
      ...(item.token === input.token ? { completionKey: input.idempotencyKey, completionDigest } : {}) } : item)
    write(state)
    const bus = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('fgae.auth') : null
    bus?.postMessage('credentials-changed'); bus?.close()
  })
}

export async function completeFirstLogin(input: FirstLoginInput, getSession: () => { email: string; expiresAt: number; credentialRevision?: number } | null, signal?: AbortSignal) {
  if (!validNewPassword(input.password)) throw new FirstLoginError('PASSWORD_REJECTED')
  if (input.password !== input.confirmation) throw new FirstLoginError('CONFIRMATION_MISMATCH')
  return locked(async () => {
    signal?.throwIfAborted()
    const session = getSession()
    if (!session || session.expiresAt <= Date.now()) throw new FirstLoginError('SESSION_EXPIRED')
    const account = accounts.find(item => item.email === session.email)
    if (!account?.mustChangePassword) throw new FirstLoginError('NOT_REQUIRED')
    const state = read()
    const previous = state.credentials[session.email]
    const payloadDigest = await digest(JSON.stringify([input.currentPassword, input.password, input.confirmation]), input.idempotencyKey)
    signal?.throwIfAborted()
    if (previous?.firstLogin?.key === input.idempotencyKey && previous.firstLogin.digest === payloadDigest && previous.firstLogin.previousRevision === (session.credentialRevision ?? 0)) return
    if ((session.credentialRevision ?? 0) !== (previous?.revision ?? 0)) throw new FirstLoginError('SESSION_EXPIRED')
    if (previous?.revision) throw new FirstLoginError('NOT_REQUIRED')
    if (!await verifyCredential(session.email, input.currentPassword)) throw new FirstLoginError('WRONG_PASSWORD')
    if (input.password === input.currentPassword) throw new FirstLoginError('SAME_PASSWORD')
    const salt = crypto.randomUUID()
    const credential: Credential = { salt, digest: await digest(input.password, salt), revision: 1,
      firstLogin: { key: input.idempotencyKey, digest: payloadDigest, previousRevision: session.credentialRevision ?? 0 } }
    signal?.throwIfAborted()
    const current = getSession()
    if (!current || current.email !== session.email || current.expiresAt !== session.expiresAt || current.expiresAt <= Date.now() || current.credentialRevision !== session.credentialRevision) throw new FirstLoginError('SESSION_EXPIRED')
    state.credentials[session.email] = credential
    state.links = state.links.map(link => link.email === session.email && !link.usedAt ? { ...link, usedAt: Date.now() } : link)
    write(state)
  })
}
