import { authService } from './auth'
import { readWorkflow, changeWorkflow } from './correction-store'
import { CorrectionError, canCorrect, mapCorrectionContext, validateCorrection, type CorrectionService, type CorrectionContext } from '../services/contracts/corrections'
import { normalizePhone, validateDocument, type RegistrationDocument } from '../services/contracts/registration'
import { readRegistrationItem, writeRegistrationItem } from './registration-store'
async function owner(signal?: AbortSignal) {
  const identity = await authService.restore(signal)
  if (!identity) throw new CorrectionError('SESSION_EXPIRED')
  if (!canCorrect(identity)) throw new CorrectionError('FORBIDDEN')
  return identity
}
async function context(signal?: AbortSignal) {
  const identity = await owner(signal); const workflow = readWorkflow(identity.id)
  if (!workflow) throw new CorrectionError('NOT_RETURNED')
  return { identity, value: mapCorrectionContext(workflow, identity.id) }
}
async function files(value: CorrectionContext, documents: RegistrationDocument[], ownerId: string, signal?: AbortSignal) {
  for (const doc of documents) {
    const original = value.application.documents.some(item => JSON.stringify(item) === JSON.stringify(doc))
    let stored = await readRegistrationItem<{ ownerId?: string; applicationId?: string; doc: RegistrationDocument; blob: Blob }>(`correction-file:${doc.id}`)
    if (stored && (stored.ownerId !== ownerId || stored.applicationId !== value.application.id)) throw new CorrectionError('DOCUMENT_MISSING')
    if (!stored && original) stored = await readRegistrationItem(`file:${doc.id}`)
    const rule = value.config.documents.find(item => item.id === doc.typeId)
    if (!stored || JSON.stringify(stored.doc) !== JSON.stringify(doc) || !rule) throw new CorrectionError('DOCUMENT_MISSING')
    await validateDocument(new File([stored.blob], doc.name, { type: doc.mime }), rule)
    signal?.throwIfAborted()
  }
}
export const correctionService: CorrectionService = {
  async load(signal) { return (await context(signal)).value },
  async save(input, signal) {
    const { identity, value } = await context(signal); validateCorrection(input, value); await files(value, input.documents, identity.id, signal)
    return changeWorkflow(identity.id, async () => { if ((await owner(signal)).id !== identity.id) throw new CorrectionError('SESSION_EXPIRED') }, workflow => {
      mapCorrectionContext(workflow, identity.id); validateCorrection(input, workflow)
      workflow.draftVersion++
      workflow.draft = { fields: input.fields, documents: input.documents, version: workflow.draftVersion, revision: workflow.revision, updatedAt: new Date().toISOString() }
      return structuredClone(workflow.draft)
    }, signal)
  },
  async discard(input, signal) {
    const { identity } = await context(signal)
    return changeWorkflow(identity.id, async () => { if ((await owner(signal)).id !== identity.id) throw new CorrectionError('SESSION_EXPIRED') }, workflow => {
      mapCorrectionContext(workflow, identity.id)
      if (input.applicationId !== workflow.application.id) throw new CorrectionError('FORBIDDEN')
      if (input.revision !== workflow.revision) throw new CorrectionError('REVISION_CONFLICT')
      if (input.draftVersion !== workflow.draftVersion) throw new CorrectionError('DRAFT_CONFLICT')
      workflow.draft = null; workflow.draftVersion++; return { draftVersion: workflow.draftVersion }
    }, signal)
  },
  async upload(file, typeId, signal, progress) {
    const { identity, value } = await context(signal)
    const rule = value.config.documents.find(item => item.id === typeId)
    if (!rule || !value.documentTypes.includes(typeId)) throw new CorrectionError('FORBIDDEN')
    await validateDocument(file, rule); signal.throwIfAborted(); progress(0)
    const doc = { id: crypto.randomUUID(), typeId, name: file.name, mime: file.type, size: file.size }
    await writeRegistrationItem(`correction-file:${doc.id}`, { ownerId: identity.id, applicationId: value.application.id, doc, blob: file }, signal)
    if ((await owner(signal)).id !== identity.id) throw new CorrectionError('SESSION_EXPIRED')
    progress(100); return doc
  },
  async preview(id, signal) {
    const { identity, value } = await context(signal)
    const stored = await readRegistrationItem<{ ownerId?: string; applicationId?: string; blob: Blob }>(`correction-file:${id}`)
    if (stored?.ownerId === identity.id && stored.applicationId === value.application.id) { if ((await owner(signal)).id !== identity.id) throw new CorrectionError('SESSION_EXPIRED'); return stored.blob }
    // Existing registration files can only be read through this authenticated application's attachment list.
    if (value.application.documents.some(doc => doc.id === id)) {
      const original = await readRegistrationItem<{ blob: Blob }>(`file:${id}`)
      if (original) { if ((await owner(signal)).id !== identity.id) throw new CorrectionError('SESSION_EXPIRED'); return original.blob }
    }
    throw new CorrectionError('DOCUMENT_MISSING')
  },
  async submit(input, signal) {
    const identity = await owner(signal)
    const payload = JSON.stringify(input)
    const current = readWorkflow(identity.id)
    const prior = current?.receipts.find(item => item.key === input.idempotencyKey)
    if (prior) { if (prior.payload !== payload) throw new CorrectionError('VALIDATION'); return prior.receipt }
    const value = mapCorrectionContext(current, identity.id)
    validateCorrection(input, value, true); await files(value, input.documents, identity.id, signal)
    return changeWorkflow(identity.id, async () => { if ((await owner(signal)).id !== identity.id) throw new CorrectionError('SESSION_EXPIRED') }, workflow => {
      const replay = workflow.receipts.find(item => item.key === input.idempotencyKey)
      if (replay) { if (replay.payload !== payload) throw new CorrectionError('VALIDATION'); return replay.receipt }
      mapCorrectionContext(workflow, identity.id); validateCorrection(input, workflow, true)
      const at = new Date().toISOString()
      workflow.versions = [...(workflow.versions ?? []), { revision: workflow.revision, fields: workflow.application.fields, documents: workflow.application.documents }]
      workflow.revision++; workflow.draftVersion++; workflow.draft = null
      workflow.application = { ...workflow.application, status: 'PENDING', updatedAt: at,
        fields: { ...input.fields, phone: normalizePhone(input.fields.phone), fullName: input.fields.fullName.trim() }, documents: input.documents,
        branchName: workflow.config.branches.find(branch => branch.id === input.fields.branchId)?.name ?? '',
        history: [...workflow.application.history, { id: crypto.randomUUID(), status: 'PENDING', at, note: '' }],
      }
      const receipt = { id: workflow.application.id, status: 'PENDING' as const, revision: workflow.revision, resubmittedAt: at }
      workflow.receipts.push({ key: input.idempotencyKey, payload, receipt }); return receipt
    }, signal)
  },
}
