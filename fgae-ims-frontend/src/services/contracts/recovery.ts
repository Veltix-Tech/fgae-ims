export interface RecoveryRequest { email: string; locale: 'en' | 'am'; idempotencyKey: string }
export interface RecoveryReceipt { email: string; acceptedAt: number; retryAt: number }
export type RecoveryErrorCode = 'NETWORK' | 'UNAVAILABLE' | 'RATE_LIMITED' | 'INVALID_EMAIL' | 'STORAGE_UNAVAILABLE'
export class RecoveryError extends Error {
  constructor(public readonly code: RecoveryErrorCode, public readonly retryAfterSeconds = 0) { super(code); this.name = 'RecoveryError' }
}
export interface RecoveryService {
  request(input: RecoveryRequest, signal?: AbortSignal): Promise<RecoveryReceipt>
  restoreReceipt(): RecoveryReceipt | null
  clearReceipt(): void
}
export const validRecoveryEmail = (email: string) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
