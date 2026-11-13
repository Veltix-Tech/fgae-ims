import type { Identity } from './auth'
import type { FirstLoginInput } from './first-login'
import { normalizePhone, type RegistrationDocument, type RegistrationService } from './registration'
export const accountCodes = ['SESSION_EXPIRED', 'FORBIDDEN', 'CONFLICT', 'VALIDATION', 'WRONG_PASSWORD', 'SAME_PASSWORD', 'PASSWORD_REJECTED', 'CONFIRMATION_MISMATCH', 'FILE_TYPE', 'FILE_SIZE', 'DOCUMENT_MISSING', 'NETWORK', 'RATE_LIMITED', 'STORAGE_UNAVAILABLE', 'UNAVAILABLE'] as const
export class AccountError extends Error { constructor(public readonly code: typeof accountCodes[number]) { super(code); this.name = 'AccountError' } }
export interface AccountProfile { ownerId: string; version: number; name: string; phone: string; locale: 'en' | 'am'; photo: RegistrationDocument | null; editableFields: ('name' | 'phone')[] }
export type AccountInput = Omit<AccountProfile, 'editableFields'>
export interface AccountSnapshot { identity: Identity; profile: AccountProfile }
export interface AccountService extends Pick<RegistrationService, 'upload' | 'preview'> {
  load(signal?: AbortSignal): Promise<AccountSnapshot>
  save(input: AccountInput, signal?: AbortSignal): Promise<AccountProfile>
  password(input: FirstLoginInput, signal?: AbortSignal): Promise<void>
}
export function accountFields(input: Pick<AccountProfile, 'name' | 'phone'>) {
  return { name: input.name.trim().length < 2 || input.name.length > 150 ? 'regNameInvalid' : undefined,
    phone: input.phone && !/^\+[1-9]\d{7,14}$/.test(normalizePhone(input.phone)) ? 'regPhoneInvalid' : undefined } as const
}
export function canManageAccount(identity: Identity) { return !identity.mustChangePassword && (identity.accountState === 'PENDING' || identity.grants.length > 0) }
export const photoRule = { id: 'photo', label: { en: 'Profile photo', am: 'የመለያ ፎቶ' }, required: false, types: ['image/jpeg', 'image/png'], maxBytes: 2 * 1024 * 1024 }
export function mapAccountProfile(value: unknown, ownerId: string): AccountProfile {
  const data = value as AccountProfile
  if (!data || data.ownerId !== ownerId || !Number.isInteger(data.version) || data.version < 1 || typeof data.name !== 'string' || typeof data.phone !== 'string' || !['en', 'am'].includes(data.locale) || !Array.isArray(data.editableFields) || data.editableFields.some(field => !['name', 'phone'].includes(field))) throw new AccountError('UNAVAILABLE')
  if (data.photo !== null && (!data.photo || typeof data.photo.id !== 'string' || !data.photo.id || data.photo.typeId !== 'photo' || typeof data.photo.name !== 'string' || !photoRule.types.includes(data.photo.mime) || !Number.isFinite(data.photo.size) || data.photo.size <= 0 || data.photo.size > photoRule.maxBytes)) throw new AccountError('UNAVAILABLE')
  return data
}
