export const resetPasswordPolicy = { minLength: 12, maxLength: 128 } as const
export interface ResetRequest { token: string; password: string; confirmation: string; idempotencyKey: string }
export interface ResetLink { expiresAt: number }
export type ResetErrorCode = 'INVALID_LINK' | 'EXPIRED_LINK' | 'USED_LINK' | 'NETWORK' | 'UNAVAILABLE' |
  'RATE_LIMITED' | 'PASSWORD_REJECTED' | 'SAME_PASSWORD' | 'CONFIRMATION_MISMATCH' | 'STORAGE_UNAVAILABLE'
export class ResetError extends Error {
  constructor(public readonly code: ResetErrorCode) { super(code); this.name = 'ResetError' }
}
export interface ResetPasswordService {
  validate(token: string, signal?: AbortSignal): Promise<ResetLink>
  complete(input: ResetRequest, signal?: AbortSignal): Promise<void>
}
export function validNewPassword(value: string) {
  const length = [...value].length
  return length >= resetPasswordPolicy.minLength && length <= resetPasswordPolicy.maxLength && /\S/u.test(value)
}
