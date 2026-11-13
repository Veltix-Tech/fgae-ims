import { ResetError, validNewPassword, type ResetRequest } from '../services/contracts/reset-password'
import { accounts } from './identities'
import { FirstLoginError, type FirstLoginInput } from '../services/contracts/first-login'
import { type Identity } from '../services/contracts/auth'
import { RegistrationError, normalizePhone, type RegistrationInput, type RegistrationReceipt } from '../services/contracts/registration'
import { AccountError, accountFields, canManageAccount, type AccountInput, type AccountProfile } from '../services/contracts/account'

const STORE = 'fgae.synthetic.credentials.v1'
const INITIAL_PASSWORD = 'Demo-only-2026!'
type Credential = { salt: string; digest: string; revision: number; firstLogin?: { key: string; digest: string; previousRevision: number }; passwordChange?: { key: string; digest: string; previousRevision: number } }
type Link = { token: string; email: string; expiresAt: number; usedAt?: number; completionKey?: string; completionDigest?: string }
type Application = { identity: Identity; fields: RegistrationInput['fields']; documents: RegistrationInput['documents']; receipt: RegistrationReceipt; key: string; digest: string }
type State = { version: 1; credentials: Record<string, Credential>; links: Link[]; applications?: Application[]; profiles?: Record<string, AccountProfile> }
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
export function readOwnApplication(ownerId: string) {
  const item = read().applications?.find(application => application.identity.id === ownerId)
  return item ? structuredClone({ fields: item.fields, documents: item.documents, receipt: item.receipt }) : null
}
export function findAccount(email: string) {
  const state = read(); const identity = accounts.find(item => item.email === email.toLowerCase()) ?? state.applications?.find(item => item.identity.email === email.toLowerCase())?.identity
  return identity ? { ...identity, name: state.profiles?.[identity.id]?.name ?? identity.name } : undefined
}
export function readProfile(identity: Identity): AccountProfile {
  const state = read()
  return structuredClone(state.profiles?.[identity.id] ?? { ownerId: identity.id, version: 1, name: identity.name, phone: state.applications?.find(item => item.identity.id === identity.id)?.fields.phone ?? '', locale: 'en', photo: null, editableFields: ['name', 'phone'] })
}
export async function saveProfile(input: AccountInput, guard: () => Promise<Identity>, signal?: AbortSignal) {
  return locked(async () => {
    const identity = await guard(); signal?.throwIfAborted()
    if (identity.id !== input.ownerId) throw new AccountError('FORBIDDEN')
    const current = readProfile(identity)
    if (current.version !== input.version) throw new AccountError('CONFLICT')
    if (Object.values(accountFields(input)).some(Boolean) || !['en', 'am'].includes(input.locale)) throw new AccountError('VALIDATION')
    for (const field of ['name', 'phone'] as const) if (!current.editableFields.includes(field) && input[field] !== current[field]) throw new AccountError('FORBIDDEN')
    const next = { ...current, name: input.name.trim(), phone: normalizePhone(input.phone), locale: input.locale, photo: input.photo, version: current.version + 1 }
    const state = read(); state.profiles = { ...state.profiles, [identity.id]: next }; write(state); return structuredClone(next)
  })
}
export async function changeAccountPassword(input: FirstLoginInput, getSession: () => { email: string; expiresAt: number; credentialRevision?: number } | null, signal?: AbortSignal) {
  if (!validNewPassword(input.password)) throw new AccountError('PASSWORD_REJECTED')
  if (input.password !== input.confirmation) throw new AccountError('CONFIRMATION_MISMATCH')
  return locked(async () => {
    signal?.throwIfAborted(); const session = getSession()
    if (!session || session.expiresAt <= Date.now()) throw new AccountError('SESSION_EXPIRED')
    const identity = findAccount(session.email); const state = read(); const previous = state.credentials[session.email]
    if (!identity || !canManageAccount({ ...identity, mustChangePassword: identity.mustChangePassword && !previous?.revision })) throw new AccountError('FORBIDDEN')
    const payload = await digest(JSON.stringify([input.currentPassword, input.password, input.confirmation]), input.idempotencyKey)
    signal?.throwIfAborted()
    if (previous?.passwordChange?.key === input.idempotencyKey && previous.passwordChange.digest === payload && previous.passwordChange.previousRevision === (session.credentialRevision ?? 0)) return
    if ((session.credentialRevision ?? 0) !== (previous?.revision ?? 0)) throw new AccountError('SESSION_EXPIRED')
    if (!await verifyCredential(session.email, input.currentPassword)) throw new AccountError('WRONG_PASSWORD')
    if (input.currentPassword === input.password) throw new AccountError('SAME_PASSWORD')
    const salt = crypto.randomUUID(); const verifier = await digest(input.password, salt)
    signal?.throwIfAborted(); const current = getSession()
    if (!current || current.email !== session.email || current.expiresAt !== session.expiresAt || current.expiresAt <= Date.now() || current.credentialRevision !== session.credentialRevision) throw new AccountError('SESSION_EXPIRED')
    state.credentials[session.email] = { salt, digest: verifier, revision: (previous?.revision ?? 0) + 1, passwordChange: { key: input.idempotencyKey, digest: payload, previousRevision: session.credentialRevision ?? 0 } }
    state.links = state.links.map(link => link.email === session.email && !link.usedAt ? { ...link, usedAt: Date.now() } : link)
    write(state)
  })
}
export async function verifyCredential(email: string, password: string) {
  const credential = read().credentials[email.toLowerCase()]
  return credential ? await digest(password, credential.salt) === credential.digest : password === INITIAL_PASSWORD
}
export async function issueRecoveryLink(email: string, requestKey: string) {
  return locked(async () => {
    const account = findAccount(email)
    // The public request returns the same response even when no synthetic delivery is created.
    if (!account) return
    const state = read()
    const token = `synthetic-reset-${requestKey}`
    if (state.links.some(link => link.token === token)) return
    state.links = [...state.links.slice(-39), { token, email: account.email, expiresAt: Date.now() + 15 * 60_000 }]
    write(state)
  })
}

export async function registerApplicant(input: RegistrationInput, signal?: AbortSignal): Promise<RegistrationReceipt> {
  return locked(async () => {
    signal?.throwIfAborted()
    const state = read()
    const fields = { ...input.fields, email: input.fields.email.trim().toLowerCase(), fullName: input.fields.fullName.trim(), phone: normalizePhone(input.fields.phone) }
    const payload = await digest(JSON.stringify({ ...input, fields }), input.idempotencyKey)
    const existing = state.applications?.find(item => item.key === input.idempotencyKey)
    if (existing) {
      if (existing.digest !== payload) throw new RegistrationError('VALIDATION')
      return existing.receipt
    }
    if (findAccount(fields.email) || fields.email === 'inactive@example.test') throw new RegistrationError('EMAIL_IN_USE')
    const id = `application-${crypto.randomUUID()}`
    const receipt: RegistrationReceipt = { id, email: fields.email, submittedAt: new Date().toISOString(), status: 'PENDING' }
    const salt = crypto.randomUUID()
    state.credentials[fields.email] = { salt, digest: await digest(input.password, salt), revision: 1 }
    state.applications = [...(state.applications ?? []), { fields, documents: input.documents, receipt, key: input.idempotencyKey, digest: payload,
      identity: { id, name: fields.fullName, email: fields.email, grants: [], accountState: 'PENDING', mustChangePassword: false } }]
    signal?.throwIfAborted()
    try { write(state) } catch { throw new RegistrationError('STORAGE_UNAVAILABLE') }
    return receipt
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
