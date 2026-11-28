import type { Identity } from './auth'
import { canCreateArea, type AreaBranch, AreaError } from './areas'
import { mapOwnApplication, type OwnApplication } from './application'
import type { RegistrationConfig, RegistrationDocument, RegistrationFields, PersonField, RegistrationService } from './registration'
export const canReview = (i: Identity) => canCreateArea(i) || i.accountState === 'ACTIVE' && !i.mustChangePassword && i.grants.some(g => g.role === 'VOLUNTEER_MANAGER' && (g.scope.kind === 'global' && g.scope.id === '*' || ['area','branch'].includes(g.scope.kind)))
export const canReviewBranch = (i: Identity, b: AreaBranch) => canCreateArea(i) || canReview(i) && i.grants.some(g => g.role === 'VOLUNTEER_MANAGER' && (g.scope.kind === 'global' && g.scope.id === '*' || g.scope.kind === 'area' && g.scope.id === b.areaId || g.scope.kind === 'branch' && g.scope.id === b.id))
export interface ReviewRecord { application: OwnApplication; revision: number; source: 'SELF' | 'STAFF'; submittedBy: string; submittedByName: string; payment: 'NOT_CONFIGURED'; supervisorId: string | null }
export interface ReviewSnapshot { identity: Identity; records: ReviewRecord[]; branches: AreaBranch[]; config: RegistrationConfig; supervisors: { id: string; name: string; branchIds: string[] }[] }
export interface ReviewDecision { branchId: string; supervisorId: string | null; id: string; revision: number; status: 'APPROVED' | 'RETURNED' | 'REJECTED'; note: string; editableFields: Exclude<PersonField,'email'>[]; documentTypes: string[]; idempotencyKey: string }
export interface StaffInput { fields: RegistrationFields; documents: RegistrationDocument[]; supervisorId: string | null; configVersion: string; confirmed: boolean; idempotencyKey: string }
export interface ReviewReceipt { record: ReviewRecord; temporaryPassword: string | null; replayed: boolean }
export interface ReviewService extends Pick<RegistrationService,'upload'|'preview'> { load(signal: AbortSignal): Promise<ReviewSnapshot>; decide(input: ReviewDecision, signal?: AbortSignal): Promise<ReviewReceipt>; register(input: StaffInput, signal?: AbortSignal): Promise<ReviewReceipt>; document(applicationId: string, documentId: string, signal: AbortSignal): Promise<Blob> }
export function validateDecision(input: ReviewDecision, record: ReviewRecord, config: RegistrationConfig) {
 if (typeof input.branchId !== 'string' || input.supervisorId !== null && typeof input.supervisorId !== 'string' || input.status !== 'APPROVED' && (input.branchId !== record.application.fields.branchId || input.supervisorId !== record.supervisorId)) throw new AreaError('VALIDATION')
 if (record.application.status !== 'PENDING' || input.revision !== record.revision) throw new AreaError('CONFLICT')
 if (!['APPROVED','RETURNED','REJECTED'].includes(input.status) || !input.idempotencyKey || input.idempotencyKey.length > 100 || input.note.length > 1000 || input.status !== 'APPROVED' && input.note.trim().length < 5) throw new AreaError('VALIDATION')
 if (input.editableFields.some(f => !['fullName','phone','birthDate','gender','branchId'].includes(f)) || input.documentTypes.some(d => !config.documents.some(r=>r.id===d)) || new Set(input.editableFields).size !== input.editableFields.length || new Set(input.documentTypes).size !== input.documentTypes.length) throw new AreaError('VALIDATION')
 if (input.status === 'RETURNED' ? !input.editableFields.length && !input.documentTypes.length : !!input.editableFields.length || !!input.documentTypes.length) throw new AreaError('VALIDATION')
}

export function mapReviewRecord(value: unknown): ReviewRecord {
 const r=value as ReviewRecord
 if(!r || !r.application || !Number.isInteger(r.revision) || r.revision<1 || !['SELF','STAFF'].includes(r.source) || typeof r.submittedBy!=='string' || !r.submittedBy || typeof r.submittedByName!=='string' || r.payment!=='NOT_CONFIGURED' || r.supervisorId!==null&&typeof r.supervisorId!=='string')throw new AreaError('INVALID_RESPONSE')
 mapOwnApplication(r.application,r.application.ownerId);return r
}
export function mapReviewSnapshot(value: unknown, identity: Identity): ReviewSnapshot {
 const d=value as ReviewSnapshot
 if(!d||d.identity?.id!==identity.id||!canReview(identity)||!Array.isArray(d.records)||!Array.isArray(d.branches)||!Array.isArray(d.supervisors)||!d.config||typeof d.config.version!=='string'||!Array.isArray(d.config.branches)||!Array.isArray(d.config.documents)||!Array.isArray(d.config.requiredFields))throw new AreaError('INVALID_RESPONSE')
 if(d.branches.some(b=>!b||typeof b.id!=='string'||typeof b.name!=='string'||!['ACTIVE','ARCHIVED'].includes(b.state)||!canReviewBranch(identity,b))||new Set(d.records.map(r=>r.application?.id)).size!==d.records.length)throw new AreaError('INVALID_RESPONSE')
 for(const r of d.records){mapReviewRecord(r);if(!d.branches.some(b=>b.id===r.application.fields.branchId))throw new AreaError('INVALID_RESPONSE')}
 if(d.config.branches.some(b=>!b||typeof b.name!=='string'||!d.branches.some(x=>x.id===b.id&&x.state==='ACTIVE'))||d.config.requiredFields.some(f=>!['fullName','email','phone','birthDate','gender','branchId'].includes(f))||d.config.documents.some(r=>!r||typeof r.id!=='string'||typeof r.label?.en!=='string'||typeof r.label?.am!=='string'||typeof r.required!=='boolean'||!Array.isArray(r.types)||!r.types.length||r.types.some(t=>!['application/pdf','image/png','image/jpeg'].includes(t))||!Number.isFinite(r.maxBytes)||r.maxBytes<=0)||d.supervisors.some(s=>!s||typeof s.id!=='string'||typeof s.name!=='string'||!Array.isArray(s.branchIds)||s.branchIds.some(id=>!d.branches.some(b=>b.id===id))))throw new AreaError('INVALID_RESPONSE')
 return {...d,identity}
}
