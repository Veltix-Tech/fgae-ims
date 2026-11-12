import { RegistrationError, type RegistrationDraft } from '../services/contracts/registration'
const database = 'fgae.synthetic.registration.v1'
async function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(database, 1)
    request.onupgradeneeded = () => request.result.createObjectStore('items')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new RegistrationError('STORAGE_UNAVAILABLE'))
  })
}
export async function readRegistrationItem<T>(key: string): Promise<T | null> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('items'); const request = tx.objectStore('items').get(key)
    tx.oncomplete = () => { db.close(); resolve(request.result ?? null) }
    tx.onerror = () => { db.close(); reject(new RegistrationError('STORAGE_UNAVAILABLE')) }
  })
}
export async function writeRegistrationItem(key: string, value: unknown, signal?: AbortSignal) {
  const db = await open()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('items', 'readwrite')
    const abort = () => tx.abort()
    signal?.addEventListener('abort', abort, { once: true })
    tx.objectStore('items').put(value, key)
    tx.oncomplete = () => { signal?.removeEventListener('abort', abort); db.close(); resolve() }
    tx.onabort = tx.onerror = () => { signal?.removeEventListener('abort', abort); db.close(); reject(signal?.aborted ? new DOMException('Aborted', 'AbortError') : new RegistrationError('STORAGE_UNAVAILABLE')) }
    if (signal?.aborted) tx.abort()
  })
}
export async function updateDraft(draft: Omit<RegistrationDraft, 'updatedAt'> | null, version: number, signal?: AbortSignal) {
  const db = await open()
  return new Promise<RegistrationDraft | null>((resolve, reject) => {
    const tx = db.transaction('items', 'readwrite'); const store = tx.objectStore('items')
    const request = store.get('draft')
    let next: RegistrationDraft | null = null
    let conflict = false
    const abort = () => tx.abort()
    signal?.addEventListener('abort', abort, { once: true })
    request.onsuccess = () => {
      const current = request.result as RegistrationDraft | undefined
      if ((current?.version ?? 0) !== version) { conflict = true; tx.abort(); return }
      if (draft) { next = { ...draft, version: version + 1, updatedAt: new Date().toISOString() }; store.put(next, 'draft') }
      else store.delete('draft')
    }
    tx.oncomplete = () => { signal?.removeEventListener('abort', abort); db.close(); resolve(next) }
    tx.onabort = tx.onerror = () => { signal?.removeEventListener('abort', abort); db.close(); reject(signal?.aborted ? new DOMException('Aborted', 'AbortError') : new RegistrationError(conflict ? 'DRAFT_CONFLICT' : 'STORAGE_UNAVAILABLE')) }
    if (signal?.aborted) tx.abort()
  })
}
