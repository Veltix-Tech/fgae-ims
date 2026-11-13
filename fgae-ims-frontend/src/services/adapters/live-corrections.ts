import { authService, client } from './live-auth'
import { CorrectionError, canCorrect, mapCorrectionContext, type CorrectionDraft, type CorrectionReceipt, type CorrectionService } from '../contracts/corrections'
import { validRegistrationDraft, type RegistrationDocument } from '../contracts/registration'
async function owner(signal?: AbortSignal) {
  const identity = await authService.restore(signal)
  if (!identity) throw new CorrectionError('SESSION_EXPIRED')
  if (!canCorrect(identity)) throw new CorrectionError('FORBIDDEN')
  return identity
}
export const correctionService: CorrectionService = {
  async load(signal) { const identity = await owner(signal); return mapCorrectionContext(await client.correction('', 'GET', undefined, signal), identity.id) },
  async save(input, signal) {
    await owner(signal)
    const value = await client.correction('/draft', 'PUT', input, signal) as unknown as CorrectionDraft
    if (!value || !validRegistrationDraft({ ...value, step: 0 }) || value.revision !== input.revision || value.version !== input.draftVersion + 1) throw new CorrectionError('UNAVAILABLE')
    return value
  },
  async discard(input, signal) {
    await owner(signal); const value = await client.correction('/draft', 'DELETE', input, signal) as { draftVersion: number }
    if (value.draftVersion !== input.draftVersion + 1) throw new CorrectionError('UNAVAILABLE'); return value
  },
  async upload(file, typeId, signal, progress) {
    await owner(signal)
    const body = new FormData(); body.append('file', file); body.append('typeId', typeId)
    const value = await client.correction('/documents', 'POST', body, signal, { progress }) as unknown as RegistrationDocument
    if (!value || typeof value.id !== 'string' || !value.id || value.typeId !== typeId || value.name !== file.name || value.mime !== file.type || value.size !== file.size) throw new CorrectionError('UNAVAILABLE')
    return value
  },
  async preview(id, signal) {
    await owner(signal); const blob = await client.correction(`/documents/${encodeURIComponent(id)}/content`, 'GET', undefined, signal, { blob: true }) as Blob
    if (!['application/pdf', 'image/png', 'image/jpeg'].includes(blob.type)) throw new CorrectionError('FILE_TYPE'); return blob
  },
  async submit(input, signal) {
    await owner(signal)
    const value = await client.correction('/resubmit', 'POST', input, signal, { key: input.idempotencyKey }) as unknown as CorrectionReceipt
    if (!value || value.id !== input.applicationId || value.status !== 'PENDING' || value.revision !== input.revision + 1 || !Number.isFinite(Date.parse(value.resubmittedAt))) throw new CorrectionError('UNAVAILABLE')
    return value
  },
}
