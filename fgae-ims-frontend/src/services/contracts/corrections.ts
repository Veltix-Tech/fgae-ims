import type { Identity } from './auth'
import { mapOwnApplication, type OwnApplication } from './application'
import { emptyRegistration, personalErrors, validRegistrationDraft, type PersonField, type RegistrationConfig, type RegistrationDocument, type RegistrationFields, type RegistrationService } from './registration'

export const correctionCodes = ['SESSION_EXPIRED', 'FORBIDDEN', 'NOT_RETURNED', 'REVISION_CONFLICT', 'DRAFT_CONFLICT', 'CONFIG_CHANGED', 'VALIDATION', 'DOCUMENT_MISSING', 'FILE_TYPE', 'FILE_SIZE', 'NETWORK', 'RATE_LIMITED', 'STORAGE_UNAVAILABLE', 'UNAVAILABLE'] as const
export class CorrectionError extends Error {
  constructor(public readonly code: typeof correctionCodes[number], public readonly fields: Partial<Record<PersonField, string>> = {}) { super(code); this.name = 'CorrectionError' }
}
export interface CorrectionValues { fields: RegistrationFields; documents: RegistrationDocument[] }
export interface CorrectionDraft extends CorrectionValues { version: number; revision: number; updatedAt: string }
export interface CorrectionContext {
  application: OwnApplication; revision: number; draftVersion: number; draft: CorrectionDraft | null
  editableFields: Exclude<PersonField, 'email'>[]; documentTypes: string[]; config: RegistrationConfig
}
export interface CorrectionInput extends CorrectionValues { applicationId: string; revision: number; draftVersion: number; configVersion: string }
export interface ResubmitInput extends CorrectionInput { confirmed: boolean; idempotencyKey: string }
export interface CorrectionReceipt { id: string; status: 'PENDING'; revision: number; resubmittedAt: string }
export interface CorrectionService extends Pick<RegistrationService, 'upload' | 'preview'> {
  load(signal?: AbortSignal): Promise<CorrectionContext>
  save(input: CorrectionInput, signal?: AbortSignal): Promise<CorrectionDraft>
  discard(input: Pick<CorrectionInput, 'applicationId' | 'revision' | 'draftVersion'>, signal?: AbortSignal): Promise<{ draftVersion: number }>
  submit(input: ResubmitInput, signal?: AbortSignal): Promise<CorrectionReceipt>
}
export function canCorrect(identity: Identity) { return identity.accountState === 'PENDING' && !identity.mustChangePassword }
export function mapCorrectionContext(value: unknown, ownerId: string): CorrectionContext {
  const data = value as CorrectionContext
  const fail = () => { throw new CorrectionError('UNAVAILABLE') }
  if (!data || typeof data !== 'object') return fail()
  const application = mapOwnApplication(data.application, ownerId)
  if (!application) return fail()
  if (application.status !== 'RETURNED') throw new CorrectionError('NOT_RETURNED')
  if (!Number.isInteger(data.revision) || data.revision < 1 || !Number.isInteger(data.draftVersion) || data.draftVersion < 0) return fail()
  if (!Array.isArray(data.editableFields) || data.editableFields.some(key => !['fullName', 'phone', 'birthDate', 'gender', 'branchId'].includes(key)) || new Set(data.editableFields).size !== data.editableFields.length) return fail()
  const config = data.config
  if (!config || typeof config.version !== 'string' || !config.version || !Array.isArray(config.requiredFields) || config.requiredFields.some(key => !(key in emptyRegistration)) || !Array.isArray(config.branches) || config.branches.some(branch => !branch || typeof branch.id !== 'string' || typeof branch.name !== 'string') || !Array.isArray(config.documents) || config.documents.some(rule => !rule || !rule.id || typeof rule.label?.en !== 'string' || typeof rule.label?.am !== 'string' || typeof rule.required !== 'boolean' || !Array.isArray(rule.types) || !rule.types.length || rule.types.some(type => !['application/pdf', 'image/png', 'image/jpeg'].includes(type)) || !Number.isFinite(rule.maxBytes) || rule.maxBytes <= 0)) return fail()
  if (!Array.isArray(data.documentTypes) || data.documentTypes.some(id => !config.documents.some(rule => rule.id === id)) || new Set(data.documentTypes).size !== data.documentTypes.length || (!data.editableFields.length && !data.documentTypes.length)) return fail()
  if (data.draft !== null) {
    if (!data.draft || !validRegistrationDraft({ ...data.draft, step: 0 }) || data.draft.version !== data.draftVersion || data.draft.revision !== data.revision) return fail()
    assertPermitted(data.draft, data)
  }
  return { application, revision: data.revision, draftVersion: data.draftVersion, draft: data.draft, editableFields: data.editableFields, documentTypes: data.documentTypes, config }
}
export function assertPermitted(values: CorrectionValues, context: CorrectionContext) {
  for (const key of Object.keys(emptyRegistration) as PersonField[]) {
    if (typeof values.fields?.[key] !== 'string' || !context.editableFields.includes(key as Exclude<PersonField, 'email'>) && values.fields[key] !== context.application.fields[key]) throw new CorrectionError('VALIDATION')
  }
  if (!Array.isArray(values.documents) || new Set(values.documents.map(doc => doc.typeId)).size !== values.documents.length) throw new CorrectionError('DOCUMENT_MISSING')
  for (const doc of context.application.documents.filter(doc => !context.documentTypes.includes(doc.typeId))) {
    if (JSON.stringify(values.documents.find(item => item.id === doc.id)) !== JSON.stringify(doc)) throw new CorrectionError('FORBIDDEN')
  }
  for (const doc of values.documents) if (!context.documentTypes.includes(doc.typeId) && !context.application.documents.some(item => JSON.stringify(item) === JSON.stringify(doc))) throw new CorrectionError('FORBIDDEN')
}
export function validateCorrection(input: CorrectionInput, context: CorrectionContext, submit = false) {
  if (input.applicationId !== context.application.id) throw new CorrectionError('FORBIDDEN')
  if (input.revision !== context.revision) throw new CorrectionError('REVISION_CONFLICT')
  if (input.draftVersion !== context.draftVersion) throw new CorrectionError('DRAFT_CONFLICT')
  if (input.configVersion !== context.config.version) throw new CorrectionError('CONFIG_CHANGED')
  assertPermitted(input, context)
  if (!submit) return
  const errors = personalErrors(input.fields, context.config)
  if (Object.keys(errors).length) throw new CorrectionError('VALIDATION', errors)
  if (context.config.documents.some(rule => rule.required && !input.documents.some(doc => doc.typeId === rule.id))) throw new CorrectionError('DOCUMENT_MISSING')
  if (!(input as ResubmitInput).confirmed || !(input as ResubmitInput).idempotencyKey) throw new CorrectionError('VALIDATION')
}
