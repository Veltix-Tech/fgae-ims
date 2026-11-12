export interface FirstLoginInput { currentPassword: string; password: string; confirmation: string; idempotencyKey: string }
export type FirstLoginErrorCode = 'SESSION_EXPIRED' | 'NOT_REQUIRED' | 'WRONG_PASSWORD' | 'SAME_PASSWORD' |
  'PASSWORD_REJECTED' | 'CONFIRMATION_MISMATCH' | 'NETWORK' | 'UNAVAILABLE' | 'RATE_LIMITED' | 'STORAGE_UNAVAILABLE'
export class FirstLoginError extends Error {
  constructor(public readonly code: FirstLoginErrorCode) { super(code); this.name = 'FirstLoginError' }
}
export interface FirstLoginService { complete(input: FirstLoginInput, signal?: AbortSignal): Promise<void> }
