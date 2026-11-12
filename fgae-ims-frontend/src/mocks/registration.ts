import { RegistrationError, validateDocument, validateRegistration, validRegistrationDraft, type RegistrationConfig, type RegistrationDocument, type RegistrationDraft, type RegistrationService } from '../services/contracts/registration'
import { registerApplicant } from './credentials'
import { readRegistrationItem, updateDraft, writeRegistrationItem } from './registration-store'
import { registrationReceiptStore } from '../services/adapters/registration-receipt'
const receipts = registrationReceiptStore('fgae.synthetic.registration.receipt.v1')
export const registrationConfig: RegistrationConfig = {
  version: 'synthetic-registration-1', requiredFields: ['fullName', 'email', 'phone', 'birthDate', 'gender', 'branchId'],
  branches: [{ id: 'fictional-branch-a', name: 'Demo branch A' }, { id: 'fictional-branch-b', name: 'Demo branch B' }],
  documents: [{ id: 'identity', label: { en: 'Identity document', am: 'የማንነት ማረጋገጫ' }, required: true, types: ['application/pdf', 'image/jpeg', 'image/png'], maxBytes: 5 * 1024 * 1024 }],
}
function check(signal?: AbortSignal) { signal?.throwIfAborted(); if (!navigator.onLine) throw new RegistrationError('NETWORK') }
export const registrationService: RegistrationService = {
  receipt: receipts.read, clearReceipt: receipts.clear,
  async config(signal) { check(signal); return structuredClone(registrationConfig) },
  async draft(signal) { check(signal); const draft = await readRegistrationItem<RegistrationDraft>('draft'); if (!validRegistrationDraft(draft)) throw new RegistrationError('STORAGE_UNAVAILABLE'); return draft },
  async saveDraft(draft, signal) { check(signal); return (await updateDraft(draft, draft.version, signal))! },
  async clearDraft(version, signal) { check(signal); await updateDraft(null, version, signal) },
  async upload(file, typeId, signal, progress) {
    check(signal)
    const rule = registrationConfig.documents.find(item => item.id === typeId)
    if (!rule) throw new RegistrationError('CONFIG_CHANGED')
    await validateDocument(file, rule); check(signal); progress(0)
    const doc: RegistrationDocument = { id: crypto.randomUUID(), typeId, name: file.name, mime: file.type, size: file.size }
    await writeRegistrationItem(`file:${doc.id}`, { doc, blob: file }, signal); progress(100)
    return doc
  },
  async preview(id, signal) {
    check(signal)
    const stored = await readRegistrationItem<{ blob: Blob }>(`file:${id}`)
    if (!stored) throw new RegistrationError('DOCUMENT_MISSING')
    check(signal); return stored.blob
  },
  async submit(input, signal) {
    check(signal); validateRegistration(input, registrationConfig)
    if (new Set(input.documents.map(doc => doc.typeId)).size !== input.documents.length) throw new RegistrationError('DOCUMENT_MISSING')
    for (const doc of input.documents) {
      const stored = await readRegistrationItem<{ doc: RegistrationDocument; blob: Blob }>(`file:${doc.id}`)
      const rule = registrationConfig.documents.find(item => item.id === doc.typeId)
      if (!stored || !rule || stored.doc.typeId !== doc.typeId || stored.doc.name !== doc.name || stored.doc.mime !== doc.mime || stored.doc.size !== doc.size) throw new RegistrationError('DOCUMENT_MISSING')
      await validateDocument(new File([stored.blob], stored.doc.name, { type: stored.doc.mime }), rule)
    }
    check(signal); const receipt = await registerApplicant(input, signal); receipts.save(receipt); return receipt
  },
}
