import { RegistrationError, validRegistrationDraft, type RegistrationConfig, type RegistrationDocument, type RegistrationDraft, type RegistrationReceipt, type RegistrationService, type RegistrationErrorCode } from '../contracts/registration'
import { registrationReceiptStore } from './registration-receipt'
const receipts = registrationReceiptStore('fgae.live.registration.receipt.v1')
const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const codes: RegistrationErrorCode[] = ['EMAIL_IN_USE', 'VALIDATION', 'CONFIG_CHANGED', 'DRAFT_CONFLICT', 'DOCUMENT_MISSING', 'FILE_TYPE', 'FILE_SIZE', 'RATE_LIMITED']
function failure(status: number, body: { code?: RegistrationErrorCode; fields?: Record<string, string> } | null) {
  const fields: Record<string, string> = {}
  const messages: Record<string, string> = { REQUIRED: 'regRequired', INVALID_EMAIL: 'regEmailInvalid', INVALID_PHONE: 'regPhoneInvalid', INVALID_DATE: 'regDateInvalid', INVALID_NAME: 'regNameInvalid', INVALID_BRANCH: 'regBranchInvalid' }
  for (const [field, code] of Object.entries(body?.fields ?? {})) if (['fullName', 'email', 'phone', 'birthDate', 'gender', 'branchId'].includes(field) && messages[code]) fields[field] = messages[code]!
  return new RegistrationError(body?.code && codes.includes(body.code) ? body.code : status === 429 ? 'RATE_LIMITED' : 'UNAVAILABLE', fields)
}
async function request<T>(path: string, method: string, body?: unknown, signal?: AbortSignal, headers?: Record<string, string>): Promise<T> {
  let response: Response
  try { response = await fetch(`${base}${path}`, { method, credentials: 'include', cache: 'no-store', signal, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) }) }
  catch (error) { if (signal?.aborted) throw error; throw new RegistrationError('NETWORK') }
  const result = await response.json().catch(() => null) as { success?: boolean; data?: T; code?: RegistrationErrorCode; fields?: Record<string, string> } | null
  if (!response.ok) throw failure(response.status, result)
  if (result?.success !== true || result.data === undefined) throw new RegistrationError('UNAVAILABLE')
  signal?.throwIfAborted(); return result.data
}
function document(value: RegistrationDocument) {
  if (!value || typeof value.id !== 'string' || typeof value.typeId !== 'string' || typeof value.name !== 'string' || !['application/pdf', 'image/png', 'image/jpeg'].includes(value.mime) || !Number.isFinite(value.size) || value.size <= 0) throw new RegistrationError('UNAVAILABLE')
  return value
}
function draft(value: RegistrationDraft | null) {
  if (!validRegistrationDraft(value)) throw new RegistrationError('UNAVAILABLE')
  value?.documents.forEach(document); return value
}
export const registrationService: RegistrationService = {
  receipt: receipts.read, clearReceipt: receipts.clear,
  async config(signal) {
    const value = await request<RegistrationConfig>('/volunteers/registration/config', 'GET', undefined, signal)
    if (!value || typeof value.version !== 'string' || !Array.isArray(value.requiredFields) || value.requiredFields.some(key => !['fullName', 'email', 'phone', 'birthDate', 'gender', 'branchId'].includes(key)) || !Array.isArray(value.branches) || value.branches.some(branch => typeof branch.id !== 'string' || typeof branch.name !== 'string') || !Array.isArray(value.documents) || value.documents.some(rule => !rule || typeof rule.id !== 'string' || typeof rule.label?.en !== 'string' || typeof rule.label?.am !== 'string' || typeof rule.required !== 'boolean' || !Array.isArray(rule.types) || !rule.types.length || rule.types.some(type => !['application/pdf', 'image/png', 'image/jpeg'].includes(type)) || !Number.isFinite(rule.maxBytes) || rule.maxBytes <= 0)) throw new RegistrationError('UNAVAILABLE')
    return value
  },
  async draft(signal) { return draft(await request('/volunteers/registration/draft', 'GET', undefined, signal)) },
  async saveDraft(value, signal) { const saved = draft(await request<RegistrationDraft>('/volunteers/registration/draft', 'PUT', value, signal)); if (!saved) throw new RegistrationError('UNAVAILABLE'); return saved },
  async clearDraft(version, signal) { await request('/volunteers/registration/draft', 'DELETE', { version }, signal) },
  upload(file, typeId, signal, progress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${base}/volunteers/registration/documents`); xhr.withCredentials = true
      const abort = () => xhr.abort()
      const cleanup = () => signal.removeEventListener('abort', abort)
      xhr.upload.onprogress = event => { if (event.lengthComputable) progress(Math.round(event.loaded / event.total * 100)) }
      xhr.onerror = () => { cleanup(); reject(new RegistrationError('NETWORK')) }
      xhr.onabort = () => { cleanup(); reject(new DOMException('Aborted', 'AbortError')) }
      xhr.onload = () => {
        cleanup()
        try {
          const result = JSON.parse(xhr.responseText) as { success?: boolean; data: RegistrationDocument; code?: RegistrationErrorCode }
          if (xhr.status < 200 || xhr.status >= 300) throw failure(xhr.status, result)
          if (result.success !== true) throw new RegistrationError('UNAVAILABLE')
          resolve(document(result.data))
        } catch (error) { reject(error instanceof RegistrationError ? error : new RegistrationError('UNAVAILABLE')) }
      }
      if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return }
      signal.addEventListener('abort', abort, { once: true })
      const form = new FormData(); form.append('file', file); form.append('typeId', typeId)
      xhr.send(form)
    })
  },
  async preview(id, signal) {
    let response: Response
    try { response = await fetch(`${base}/volunteers/registration/documents/${encodeURIComponent(id)}/content`, { credentials: 'include', cache: 'no-store', signal }) }
    catch (error) { if (signal.aborted) throw error; throw new RegistrationError('NETWORK') }
    if (!response.ok) throw failure(response.status, null)
    const blob = await response.blob()
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(blob.type)) throw new RegistrationError('FILE_TYPE')
    return blob
  },
  async submit(input, signal) {
    const receipt = await request<RegistrationReceipt>('/volunteers/applications', 'POST', input, signal, { 'Idempotency-Key': input.idempotencyKey })
    if (!receipt || typeof receipt.id !== 'string' || typeof receipt.email !== 'string' || !Number.isFinite(Date.parse(receipt.submittedAt)) || receipt.status !== 'PENDING') throw new RegistrationError('UNAVAILABLE')
    receipts.save(receipt); return receipt
  },
}
