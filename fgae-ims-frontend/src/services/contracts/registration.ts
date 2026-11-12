import { validNewPassword } from './reset-password'
export type PersonField = 'fullName' | 'email' | 'phone' | 'birthDate' | 'gender' | 'branchId'
export interface RegistrationFields { fullName: string; email: string; phone: string; birthDate: string; gender: string; branchId: string }
export const emptyRegistration: RegistrationFields = { fullName: '', email: '', phone: '', birthDate: '', gender: '', branchId: '' }
export interface DocumentRule { id: string; label: { en: string; am: string }; required: boolean; types: string[]; maxBytes: number }
export interface RegistrationConfig { version: string; requiredFields: PersonField[]; branches: { id: string; name: string }[]; documents: DocumentRule[] }
export interface RegistrationDocument { id: string; typeId: string; name: string; mime: string; size: number }
export interface RegistrationDraft { fields: RegistrationFields; documents: RegistrationDocument[]; step: number; version: number; updatedAt: string }
export function validRegistrationDraft(value: RegistrationDraft | null): boolean {
  return value === null || !!value && !!value.fields && Object.keys(emptyRegistration).every(key => typeof value.fields[key as PersonField] === 'string') &&
    Array.isArray(value.documents) && value.documents.every(doc => !!doc && typeof doc.id === 'string' && typeof doc.typeId === 'string' && typeof doc.name === 'string' && ['application/pdf', 'image/jpeg', 'image/png'].includes(doc.mime) && Number.isFinite(doc.size) && doc.size > 0) &&
    Number.isInteger(value.version) && value.version > 0 && Number.isInteger(value.step) && value.step >= 0 && value.step <= 3 && Number.isFinite(Date.parse(value.updatedAt))
}
export interface RegistrationInput { fields: RegistrationFields; documents: RegistrationDocument[]; password: string; confirmation: string; confirmed: boolean; configVersion: string; idempotencyKey: string }
export interface RegistrationReceipt { id: string; email: string; submittedAt: string; status: 'PENDING' }
export type RegistrationErrorCode = 'NETWORK' | 'UNAVAILABLE' | 'STORAGE_UNAVAILABLE' | 'EMAIL_IN_USE' | 'VALIDATION' | 'CONFIG_CHANGED' | 'DRAFT_CONFLICT' | 'DOCUMENT_MISSING' | 'FILE_TYPE' | 'FILE_SIZE' | 'RATE_LIMITED'
export class RegistrationError extends Error {
  constructor(public readonly code: RegistrationErrorCode, public readonly fields: Partial<Record<PersonField, string>> = {}) { super(code); this.name = 'RegistrationError' }
}
export interface RegistrationService {
  receipt(): RegistrationReceipt | null
  clearReceipt(): void
  config(signal?: AbortSignal): Promise<RegistrationConfig>
  draft(signal?: AbortSignal): Promise<RegistrationDraft | null>
  saveDraft(draft: Omit<RegistrationDraft, 'updatedAt'>, signal?: AbortSignal): Promise<RegistrationDraft>
  clearDraft(version: number, signal?: AbortSignal): Promise<void>
  upload(file: File, typeId: string, signal: AbortSignal, progress: (percent: number) => void): Promise<RegistrationDocument>
  preview(id: string, signal: AbortSignal): Promise<Blob>
  submit(input: RegistrationInput, signal?: AbortSignal): Promise<RegistrationReceipt>
}
export function normalizePhone(value: string) {
  const compact = value.replace(/[\s()-]/g, '')
  return /^0[79]\d{8}$/.test(compact) ? `+251${compact.slice(1)}` : compact
}
export function todayDate() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Addis_Ababa', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()) }
export function personalErrors(fields: RegistrationFields, config: RegistrationConfig) {
  const errors: Partial<Record<PersonField, string>> = {}
  for (const field of new Set([...config.requiredFields, 'email' as const])) if (!fields[field].trim()) errors[field] = 'regRequired'
  if (fields.fullName && (fields.fullName.trim().length < 2 || fields.fullName.length > 150)) errors.fullName = 'regNameInvalid'
  if (fields.email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim()) || fields.email.length > 254)) errors.email = 'regEmailInvalid'
  if (fields.phone && !/^\+[1-9]\d{7,14}$/.test(normalizePhone(fields.phone))) errors.phone = 'regPhoneInvalid'
  if (fields.birthDate && (!/^\d{4}-\d{2}-\d{2}$/.test(fields.birthDate) || !Number.isFinite(Date.parse(fields.birthDate)) || new Date(fields.birthDate).toISOString().slice(0, 10) !== fields.birthDate || fields.birthDate > todayDate())) errors.birthDate = 'regDateInvalid'
  if (fields.gender && !['FEMALE', 'MALE', 'OTHER', 'UNDISCLOSED'].includes(fields.gender)) errors.gender = 'regRequired'
  if (fields.branchId && !config.branches.some(branch => branch.id === fields.branchId)) errors.branchId = 'regBranchInvalid'
  return errors
}
export function validateRegistration(input: RegistrationInput, config: RegistrationConfig) {
  if (input.configVersion !== config.version) throw new RegistrationError('CONFIG_CHANGED')
  const fields = personalErrors(input.fields, config)
  if (Object.keys(fields).length || !validNewPassword(input.password) || input.password !== input.confirmation || !input.confirmed) throw new RegistrationError('VALIDATION', fields)
  if (config.documents.some(rule => rule.required && !input.documents.some(doc => doc.typeId === rule.id))) throw new RegistrationError('DOCUMENT_MISSING')
}
export async function validateDocument(file: File, rule: DocumentRule) {
  if (!file.size || file.size > rule.maxBytes) throw new RegistrationError('FILE_SIZE')
  if (!rule.types.includes(file.type)) throw new RegistrationError('FILE_TYPE')
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  const valid = file.type === 'application/pdf' ? String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-' :
    file.type === 'image/png' ? [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte) :
    file.type === 'image/jpeg' && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  if (!valid) throw new RegistrationError('FILE_TYPE')
}
