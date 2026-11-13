import { authService, readSession } from './auth'
import { readProfile, saveProfile, changeAccountPassword } from './credentials'
import { readRegistrationItem, writeRegistrationItem } from './registration-store'
import { AccountError, canManageAccount, mapAccountProfile, photoRule, type AccountService } from '../services/contracts/account'
import { validateDocument, type RegistrationDocument } from '../services/contracts/registration'
async function owner(signal?: AbortSignal) {
  const identity = await authService.restore(signal)
  if (!identity) throw new AccountError('SESSION_EXPIRED')
  if (!canManageAccount(identity)) throw new AccountError('FORBIDDEN')
  return identity
}
export const accountService: AccountService = {
  async load(signal) { const identity = await owner(signal); return { identity, profile: mapAccountProfile(readProfile(identity), identity.id) } },
  async save(input, signal) {
    const identity = await owner(signal)
    if (input.ownerId !== identity.id) throw new AccountError('FORBIDDEN')
    mapAccountProfile({ ...input, editableFields: [] }, identity.id)
    if (input.photo) {
      const file = await readRegistrationItem<{ ownerId: string; doc: RegistrationDocument; blob: Blob }>(`account-photo:${input.photo.id}`)
      if (!file || file.ownerId !== identity.id || JSON.stringify(file.doc) !== JSON.stringify(input.photo)) throw new AccountError('DOCUMENT_MISSING')
      await validateDocument(new File([file.blob], file.doc.name, { type: file.doc.mime }), photoRule)
    }
    return saveProfile(input, () => owner(signal), signal)
  },
  async upload(file, typeId, signal, progress) {
    const identity = await owner(signal)
    if (typeId !== 'photo') throw new AccountError('FILE_TYPE')
    await validateDocument(file, photoRule); signal.throwIfAborted(); progress(0)
    const doc = { id: crypto.randomUUID(), typeId, name: file.name, size: file.size, mime: file.type }
    await writeRegistrationItem(`account-photo:${doc.id}`, { ownerId: identity.id, doc, blob: file }, signal)
    if ((await owner(signal)).id !== identity.id) throw new AccountError('SESSION_EXPIRED')
    progress(100); return doc
  },
  async preview(id, signal) {
    const identity = await owner(signal)
    const file = await readRegistrationItem<{ ownerId: string; blob: Blob }>(`account-photo:${id}`)
    if (!file || file.ownerId !== identity.id) throw new AccountError('DOCUMENT_MISSING')
    if ((await owner(signal)).id !== identity.id) throw new AccountError('SESSION_EXPIRED')
    return file.blob
  },
  async password(input, signal) { if (!navigator.onLine) throw new AccountError('NETWORK'); await changeAccountPassword(input, readSession, signal) },
}
