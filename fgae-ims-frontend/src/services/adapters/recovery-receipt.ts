import type { RecoveryReceipt } from '../contracts/recovery'

// Short-lived confirmation only; never store reset tokens or passwords in browser storage.
export function receiptStore(key: string) {
  let memory: RecoveryReceipt | null = null
  return {
    read(): RecoveryReceipt | null {
      try {
        const raw = sessionStorage.getItem(key)
        const saved = raw ? JSON.parse(raw) as { version?: unknown; receipt?: RecoveryReceipt } : null
        const receipt = saved?.receipt
        memory = saved?.version === 1 && receipt && typeof receipt.email === 'string' &&
          Number.isFinite(receipt.acceptedAt) && Number.isFinite(receipt.retryAt) &&
          receipt.acceptedAt <= Date.now() && Date.now() - receipt.acceptedAt < 15 * 60_000 ? receipt : null
      } catch { /* Keep the current tab usable when persistence is unavailable. */ }
      return memory && Date.now() - memory.acceptedAt < 15 * 60_000 ? memory : null
    },
    save(receipt: RecoveryReceipt) {
      memory = receipt
      try { sessionStorage.setItem(key, JSON.stringify({ version: 1, receipt })) } catch { /* Delivery acceptance remains valid even if confirmation cannot persist. */ }
    },
    clear() {
      memory = null
      try { sessionStorage.removeItem(key) } catch { /* No server state is changed by dismissing confirmation. */ }
    },
  }
}
