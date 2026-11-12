import type { RegistrationReceipt } from '../contracts/registration'
export function registrationReceiptStore(key: string) {
  return {
    read(): RegistrationReceipt | null {
      try {
        const value = JSON.parse(sessionStorage.getItem(key) || 'null') as RegistrationReceipt | null
        return value?.status === 'PENDING' && typeof value.id === 'string' && typeof value.email === 'string' && Number.isFinite(Date.parse(value.submittedAt)) ? value : null
      } catch { return null }
    },
    save(value: RegistrationReceipt) { try { sessionStorage.setItem(key, JSON.stringify(value)) } catch { /* A completed submission remains successful if receipt caching is unavailable. */ } },
    clear() { sessionStorage.removeItem(key) },
  }
}
