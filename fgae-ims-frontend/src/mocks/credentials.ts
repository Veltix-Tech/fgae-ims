import { canReviewBranch } from '../services/contracts/review'
import type { Workflow } from './correction-store'
import type { ReviewRecord, ReviewReceipt } from '../services/contracts/review'
import { lockedOrganization, organizationAreas, organizationBranches } from './organization-store'
import { AccessError, canAdminUsers, validateAccess, type AccessInput, type AccessRecord, type AccessScope } from '../services/contracts/user-access'
import type { DirectoryUser } from '../services/contracts/portfolio'
import { ResetError, validNewPassword, type ResetRequest } from '../services/contracts/reset-password'
import { accounts } from './identities'
import { FirstLoginError, type FirstLoginInput } from '../services/contracts/first-login'
import { type Identity } from '../services/contracts/auth'
import { RegistrationError, normalizePhone, type RegistrationInput, type RegistrationReceipt } from '../services/contracts/registration'
import { AccountError, accountFields, canManageAccount, type AccountInput, type AccountProfile } from '../services/contracts/account'

const STORE = 'fgae.synthetic.credentials.v1'
const INITIAL_PASSWORD = 'Demo-only-2026!'
type Credential = { temporary?: boolean; salt: string; digest: string; revision: number; firstLogin?: { key: string; digest: string; previousRevision: number }; passwordChange?: { key: string; digest: string; previousRevision: number } }
type Link = { token: string; email: string; expiresAt: number; usedAt?: number; completionKey?: string; completionDigest?: string }
type Application = { identity: Identity; fields: RegistrationInput['fields']; documents: RegistrationInput['documents']; receipt: RegistrationReceipt; key: string; digest: string }
type State = { review?: Record<string, { record: ReviewRecord; workflow: Workflow }>; volunteers?: Record<string, { fields: RegistrationInput['fields']; documents: RegistrationInput['documents']; version: number; ownerId: string; branchId: string; supervisorId: string | null; createdAt: string }>; reviewReceipts?: Record<string, { actorId: string; payload: string; receipt: ReviewReceipt }>; version: 1; credentials: Record<string, Credential>; links: Link[]; applications?: Application[]; profiles?: Record<string, AccountProfile>; access?: Record<string, AccessRecord>; accessReceipts?: Record<string, { actorId: string; payload: string; record: AccessRecord }> }
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
export function readRegisteredIdentities() { return structuredClone(read().applications?.map(application => application.identity) ?? []) }
export function findAccount(email: string) {
  const state = read(); const identity = accounts.find(item => item.email === email.toLowerCase()) ?? state.applications?.find(item => item.identity.email === email.toLowerCase())?.identity
  const override = identity ? state.access?.[identity.id]?.user : Object.values(state.access ?? {}).find(record => record.user.email === email.toLowerCase())?.user
  if (override && !['ACTIVE', 'PENDING'].includes(override.state)) return undefined
  const current = override ? { ...override, email: identity?.email ?? override.email, accountState: override.state as Identity['accountState'] } : identity
  return current ? { ...current, name: state.profiles?.[current.id]?.name ?? current.name } : undefined
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
    if (!identity || !canManageAccount({ ...identity, mustChangePassword: requiresPasswordChange(identity) })) throw new AccountError('FORBIDDEN')
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
  return lockedOrganization(() => locked(async () => {
    signal?.throwIfAborted()
    const state = read()
    const fields = { ...input.fields, email: input.fields.email.trim().toLowerCase(), fullName: input.fields.fullName.trim(), phone: normalizePhone(input.fields.phone) }
    const payload = await digest(JSON.stringify({ ...input, fields }), input.idempotencyKey)
    const existing = state.applications?.find(item => item.key === input.idempotencyKey)
    if (existing) {
      if (existing.digest !== payload) throw new RegistrationError('VALIDATION')
      return existing.receipt
    }
    const branch = organizationBranches().find(b => b.id === fields.branchId && b.state === 'ACTIVE')
    if (!branch || !organizationAreas().some(a => a.id === branch.areaId && a.state === 'ACTIVE')) throw new RegistrationError('VALIDATION', { branchId: 'regBranchInvalid' })
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
  }))
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
    const account = findAccount(session.email)
    if (!account?.mustChangePassword) throw new FirstLoginError('NOT_REQUIRED')
    const state = read()
    const previous = state.credentials[session.email]
    const payloadDigest = await digest(JSON.stringify([input.currentPassword, input.password, input.confirmation]), input.idempotencyKey)
    signal?.throwIfAborted()
    if (previous?.firstLogin?.key === input.idempotencyKey && previous.firstLogin.digest === payloadDigest && previous.firstLogin.previousRevision === (session.credentialRevision ?? 0)) return
    if ((session.credentialRevision ?? 0) !== (previous?.revision ?? 0)) throw new FirstLoginError('SESSION_EXPIRED')
    if (previous?.revision && !previous.temporary) throw new FirstLoginError('NOT_REQUIRED')
    if (!await verifyCredential(session.email, input.currentPassword)) throw new FirstLoginError('WRONG_PASSWORD')
    if (input.password === input.currentPassword) throw new FirstLoginError('SAME_PASSWORD')
    const salt = crypto.randomUUID()
    const credential: Credential = { salt, digest: await digest(input.password, salt), revision: (previous?.revision ?? 0) + 1,
      firstLogin: { key: input.idempotencyKey, digest: payloadDigest, previousRevision: session.credentialRevision ?? 0 } }
    signal?.throwIfAborted()
    const current = getSession()
    if (!current || current.email !== session.email || current.expiresAt !== session.expiresAt || current.expiresAt <= Date.now() || current.credentialRevision !== session.credentialRevision) throw new FirstLoginError('SESSION_EXPIRED')
    state.credentials[session.email] = credential
    state.links = state.links.map(link => link.email === session.email && !link.usedAt ? { ...link, usedAt: Date.now() } : link)
    write(state)
  })
}

export function requiresPasswordChange(identity: Identity) { const credential = read().credentials[identity.email]; return credential?.temporary ?? (identity.mustChangePassword && !credential?.revision) }
export function accessRecord(id: string) { return structuredClone(read().access?.[id] ?? null) }
export function applyAccessDirectory(rows: DirectoryUser[]) {
  const state = read(); const result = new Map(rows.map(row => [row.id, row]))
  for (const record of Object.values(state.access ?? {})) result.set(record.user.id, structuredClone(record.user))
  return [...result.values()].map(row => ({ ...row, name: state.profiles?.[row.id]?.name ?? row.name, mustChangePassword: state.credentials[row.email]?.temporary ?? (row.mustChangePassword && !state.credentials[row.email]?.revision) }))
}
export async function mutateAccess(input: AccessInput, scopes: AccessScope[], list: () => DirectoryUser[], guard: () => Promise<Identity>, signal?: AbortSignal) {
  return locked(async () => {
    const actor = await guard(); if (!canAdminUsers(actor)) throw new AccessError('FORBIDDEN')
    signal?.throwIfAborted(); validateAccess(input, scopes)
    const state = read(); const payload = JSON.stringify(input); const prior = state.accessReceipts?.[input.idempotencyKey]
    if (prior) { if (prior.actorId !== actor.id || prior.payload !== payload) throw new AccessError('CONFLICT'); return { ownerId: actor.id, record: structuredClone(prior.record), temporaryPassword: null, replayed: true } }
    const all = list(); const before = input.id ? all.find(row => row.id === input.id) : undefined
    if (input.id && !before) throw new AccessError('NOT_FOUND')
    if (input.state === 'PENDING' && before?.state !== 'PENDING') throw new AccessError('VALIDATION')
    if (input.version !== (before ? state.access?.[before.id]?.version ?? 1 : 0)) throw new AccessError('CONFLICT')
    if (before && (before.email !== input.email || before.name !== input.name)) throw new AccessError('CONFLICT')
    if (!before && (all.some(row => row.email.toLowerCase() === input.email.trim().toLowerCase()) || findAccount(input.email))) throw new AccessError('EMAIL_IN_USE')
    if (input.reset && before?.id === actor.id) throw new AccessError('SELF_RESET')
    const id = before?.id ?? `synthetic-admin-${crypto.randomUUID()}`
    const admin = (row: DirectoryUser) => row.state === 'ACTIVE' && !row.mustChangePassword && row.grants.some(grant => grant.role === 'SUPER_ADMIN' && grant.scope.kind === 'global' && grant.scope.id === '*')
    const user: DirectoryUser = { id, name: input.name.trim(), email: input.email.trim().toLowerCase(), state: input.state, mustChangePassword: !before || input.reset ? true : before.mustChangePassword, grants: input.grants.map(grant => ({ ...grant, scope: { ...grant.scope, id: ['self','supervision'].includes(grant.scope.kind) && grant.scope.id === '@self' ? id : grant.scope.id }, scopeName: scopes.find(scope => scope.kind === grant.scope.kind && scope.id === grant.scope.id)!.name })) }
    if (before && admin(before) && !admin(user) && !all.some(row => row.id !== id && admin(row))) throw new AccessError('LAST_ADMIN')
    const temporaryPassword = !before || input.reset ? `Fgae-${crypto.randomUUID()}!` : null
    const emails = new Set([user.email, ...accounts.filter(row => row.id === id).map(row => row.email)])
    for (const email of emails) {
      const current = state.credentials[email]; const salt = temporaryPassword ? crypto.randomUUID() : current?.salt ?? crypto.randomUUID()
      state.credentials[email] = { salt, digest: temporaryPassword ? await digest(temporaryPassword, salt) : current?.digest ?? await digest(INITIAL_PASSWORD, salt), revision: (current?.revision ?? 0) + 1, temporary: temporaryPassword ? true : user.mustChangePassword }
    }
    state.links = state.links.map(link => emails.has(link.email) && !link.usedAt ? { ...link, usedAt: Date.now() } : link)
    const record: AccessRecord = { user, version: input.version + 1, history: [...(state.access?.[id]?.history ?? []), { id: crypto.randomUUID(), at: new Date().toISOString(), actor: actor.name, actorId: actor.id, action: !before ? 'CREATE' : input.reset ? 'RESET' : 'UPDATE', reason: input.reason.trim(), before: before ?? null, after: user }] }
    state.access = { ...state.access, [id]: record }; state.accessReceipts = { ...state.accessReceipts, [input.idempotencyKey]: { actorId: actor.id, payload, record } }
    signal?.throwIfAborted(); const freshActor = await guard(); if (freshActor.id !== actor.id || !canAdminUsers(freshActor)) throw new AccessError('SESSION_EXPIRED')
    write(state)
    return { ownerId: actor.id, record: structuredClone(record), temporaryPassword, replayed: false }
  })
}

export function readReviewed(ownerId: string) { return structuredClone(read().review?.[ownerId] ?? null) }
// The application, profile, credential and grants share one atomic storage commit.
// Caller holds the organization lock, also used by applicant corrections.
export async function commitReview(actor: Identity, key: string, payload: string, prepare: () => Promise<{ record: ReviewRecord; workflow: Workflow; staff: boolean }>, guard: () => Promise<Identity>, signal?: AbortSignal): Promise<ReviewReceipt> {
 return locked(async () => {
  const state = read(); const previous = state.reviewReceipts?.[key]
  if (previous) { const branch = organizationBranches().find(b=>b.id===previous.receipt.record.application.fields.branchId); if(!branch || !canReviewBranch(actor,branch))throw new AccessError('FORBIDDEN'); if (previous.actorId !== actor.id || previous.payload !== payload) throw new AccessError('CONFLICT'); return {...structuredClone(previous.receipt), temporaryPassword: null, replayed: true} }
  const {record,workflow,staff} = await prepare(); const app = record.application; const email = app.fields.email.trim().toLowerCase(); let temporaryPassword: string | null = null
  if (staff) {
   if (findAccount(email) || accounts.some(i=>i.email===email) || state.applications?.some(a=>a.identity.email===email) || Object.values(state.access??{}).some(a=>a.user.email===email)) throw new AccessError('EMAIL_IN_USE')
   state.applications = [...(state.applications ?? []), {identity:{id:app.ownerId,name:app.fields.fullName,email,accountState:'PENDING',mustChangePassword:true,grants:[]},fields:app.fields,documents:app.documents,receipt:{id:app.id,email,submittedAt:app.submittedAt,status:'PENDING'},key,digest:payload}]
   temporaryPassword=`Fgae-${crypto.randomUUID()}!`;const salt=crypto.randomUUID();state.credentials[email]={salt,digest:await digest(temporaryPassword,salt),revision:1,temporary:true}
  }
  if (app.status === 'APPROVED') {
   if (record.source === 'STAFF' && !state.credentials[email]) { temporaryPassword=`Fgae-${crypto.randomUUID()}!`;const salt=crypto.randomUUID();state.credentials[email]={salt,digest:await digest(temporaryPassword,salt),revision:1,temporary:true} }
   const base=state.access?.[app.ownerId]?.user
   const user: DirectoryUser={id:app.ownerId,name:app.fields.fullName,email,state:'ACTIVE',mustChangePassword:state.credentials[email]?.temporary??false,grants:[...(base?.grants.filter(g=>g.role!=='VOLUNTEER')??[]),{role:'VOLUNTEER',scope:{kind:'self',id:app.ownerId},scopeName:app.fields.fullName}]}
   state.access={...state.access,[app.ownerId]:{user,version:(state.access?.[app.ownerId]?.version??0)+1,history:[...(state.access?.[app.ownerId]?.history??[]),{id:crypto.randomUUID(),at:app.updatedAt,actor:actor.name,actorId:actor.id,action:base?'UPDATE':'CREATE',reason:'Volunteer application approved',before:base??null,after:user}]}}
   const profile=state.profiles?.[app.ownerId];state.profiles={...state.profiles,[app.ownerId]:{ownerId:app.ownerId,name:app.fields.fullName,phone:app.fields.phone,locale:profile?.locale??'en',photo:profile?.photo??null,editableFields:profile?.editableFields??['name','phone'],version:(profile?.version??0)+1}}
   state.volunteers={...state.volunteers,[app.ownerId]:{fields:structuredClone(app.fields),documents:structuredClone(app.documents),version:1,ownerId:app.ownerId,branchId:app.fields.branchId,supervisorId:record.supervisorId,createdAt:app.updatedAt}}
  }
  state.review={...state.review,[app.ownerId]:{record,workflow}}
  const receipt:ReviewReceipt={record,temporaryPassword:null,replayed:false}
  state.reviewReceipts={...state.reviewReceipts,[key]:{actorId:actor.id,payload,receipt}}
  signal?.throwIfAborted();const current=await guard();if(JSON.stringify(current)!==JSON.stringify(actor))throw new AccessError('SESSION_EXPIRED')
  write(state); return {...structuredClone(receipt),temporaryPassword}
 })
}
