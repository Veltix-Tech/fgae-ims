import { RecoveryError, validRecoveryEmail, type RecoveryService } from '../contracts/recovery'
import { receiptStore } from './recovery-receipt'

const receipts = receiptStore('fgae.recovery.confirmation.v1')
export const recoveryService: RecoveryService = {
  restoreReceipt: () => receipts.read(),
  clearReceipt: () => receipts.clear(),
  async request(input, signal) {
    if (!validRecoveryEmail(input.email)) throw new RecoveryError('INVALID_EMAIL')
    let response: Response
    try {
      // C-AUTH-05: proposed public endpoint; backend must return the same response for all addresses.
      response = await fetch(`${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')}/auth/forgot-password`, {
        method: 'POST', credentials: 'omit', signal,
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': input.idempotencyKey },
        body: JSON.stringify({ email: input.email.trim(), locale: input.locale }),
      })
    } catch (error) {
      if (signal?.aborted) throw error
      throw new RecoveryError('NETWORK')
    }
    if (response.status === 429) {
      const seconds = Number(response.headers.get('Retry-After') || 60)
      throw new RecoveryError('RATE_LIMITED', Number.isFinite(seconds) ? Math.min(3600, Math.max(1, seconds)) : 60)
    }
    if (!response.ok) throw new RecoveryError('UNAVAILABLE')
    let body: { success?: boolean; data?: { accepted?: boolean; retry_after_seconds?: number } }
    try { body = await response.json() as typeof body } catch { throw new RecoveryError('UNAVAILABLE') }
    const seconds = body?.data?.retry_after_seconds
    if (body?.success !== true || body.data?.accepted !== true || typeof seconds !== 'number' ||
      !Number.isFinite(seconds) || seconds < 0 || seconds > 3600) throw new RecoveryError('UNAVAILABLE')
    signal?.throwIfAborted()
    const receipt = { email: input.email.trim(), acceptedAt: Date.now(), retryAt: Date.now() + seconds * 1000 }
    receipts.save(receipt)
    return receipt
  },
}
