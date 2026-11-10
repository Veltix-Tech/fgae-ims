import { RecoveryError, validRecoveryEmail, type RecoveryRequest, type RecoveryReceipt, type RecoveryService } from '../services/contracts/recovery'
import { receiptStore } from '../services/adapters/recovery-receipt'

const receipts = receiptStore('fgae.synthetic.recovery.confirmation.v1')
const JOURNAL = 'fgae.synthetic.recovery.requests.v1'
type RequestRecord = RecoveryRequest & { receipt: RecoveryReceipt }
function readJournal(): RequestRecord[] {
  try {
    const raw = sessionStorage.getItem(JOURNAL)
    if (!raw) return []
    const store = JSON.parse(raw) as { version?: unknown; requests?: RequestRecord[] }
    if (store.version !== 1 || !Array.isArray(store.requests)) return []
    return store.requests.filter(item => item && typeof item.idempotencyKey === 'string' &&
      typeof item.email === 'string' && item.receipt && Number.isFinite(item.receipt.acceptedAt) && Number.isFinite(item.receipt.retryAt))
  } catch (error) {
    if (error instanceof SyntaxError) return []
    throw new RecoveryError('STORAGE_UNAVAILABLE')
  }
}
export const recoveryService: RecoveryService = {
  restoreReceipt: () => receipts.read(),
  clearReceipt: () => receipts.clear(),
  async request(input, signal) {
    await Promise.resolve()
    signal?.throwIfAborted()
    if (!navigator.onLine) throw new RecoveryError('NETWORK')
    if (!validRecoveryEmail(input.email)) throw new RecoveryError('INVALID_EMAIL')
    const journal = readJournal()
    const previous = journal.find(item => item.idempotencyKey === input.idempotencyKey)
    if (previous) {
      if (previous.email !== input.email.trim()) throw new RecoveryError('UNAVAILABLE')
      receipts.save(previous.receipt)
      return previous.receipt
    }
    const latest = journal.at(-1)?.receipt
    if (latest && latest.retryAt > Date.now()) throw new RecoveryError('RATE_LIMITED', Math.ceil((latest.retryAt - Date.now()) / 1000))
    // No account lookup: known, unknown, inactive and pending addresses have identical public outcomes.
    // This records a synthetic recovery intent; real token issuance and email delivery require C-AUTH-05.
    const receipt = { email: input.email.trim(), acceptedAt: Date.now(), retryAt: Date.now() + 60_000 }
    const next = [...journal.slice(-19), { ...input, email: receipt.email, receipt }]
    try { sessionStorage.setItem(JOURNAL, JSON.stringify({ version: 1, requests: next })) }
    catch { throw new RecoveryError('STORAGE_UNAVAILABLE') }
    receipts.save(receipt)
    return receipt
  },
}
