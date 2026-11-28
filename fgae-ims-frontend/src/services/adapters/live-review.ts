import { authService,client } from './live-auth'
import { AreaError,canCreateArea } from '../contracts/areas'
import { canReview,mapReviewRecord,mapReviewSnapshot,type ReviewService,type ReviewReceipt } from '../contracts/review'
import type { RegistrationDocument } from '../contracts/registration'
async function guard(signal?:AbortSignal){const i=await authService.restore(signal);if(!i)throw new AreaError('SESSION_EXPIRED');if(!canReview(i))throw new AreaError('FORBIDDEN');return i}
function safeBlob(value: unknown) { if(!(value instanceof Blob)||!['application/pdf','image/png','image/jpeg'].includes(value.type)||!value.size)throw new AreaError('INVALID_RESPONSE');return value }
function receipt(value:unknown){const r=value as ReviewReceipt;if(!r||typeof r.replayed!=='boolean'||r.temporaryPassword!==null&&typeof r.temporaryPassword!=='string'||r.replayed&&r.temporaryPassword)throw new AreaError('INVALID_RESPONSE');mapReviewRecord(r.record);return r}
export const reviewService:ReviewService={
 async load(signal){const identity=await guard(signal);return mapReviewSnapshot(await client.reviewRequest('','GET',undefined,signal),identity)},
 async decide(input,signal){await guard(signal);const r=receipt(await client.reviewRequest(`/applications/${encodeURIComponent(input.id)}/decision`,'POST',input,signal,{key:input.idempotencyKey}));if(r.record.application.id!==input.id||r.record.application.status!==input.status||r.record.revision!==input.revision+1||r.record.application.fields.branchId!==input.branchId||r.record.supervisorId!==input.supervisorId)throw new AreaError('INVALID_RESPONSE');return r},
 async register(input,signal){const actor=await guard(signal);const r=receipt(await client.reviewRequest('/registrations','POST',input,signal,{key:input.idempotencyKey}));if(r.record.source!=='STAFF'||r.record.submittedBy!==actor.id||r.record.application.status!==(canCreateArea(actor)?'APPROVED':'PENDING')||!r.replayed&&!r.temporaryPassword||r.record.application.fields.email!==input.fields.email.trim().toLowerCase()||r.record.application.fields.branchId!==input.fields.branchId)throw new AreaError('INVALID_RESPONSE');return r},
 async upload(file,typeId,signal,progress){await guard(signal);const form=new FormData();form.append('file',file);form.append('typeId',typeId);const d=await client.reviewRequest('/documents','POST',form,signal,{progress}) as unknown as RegistrationDocument;if(!d||typeof d.id!=='string'||d.typeId!==typeId||d.name!==file.name||d.mime!==file.type||d.size!==file.size)throw new AreaError('INVALID_RESPONSE');return d},
 async preview(id,signal){await guard(signal);return safeBlob(await client.reviewRequest(`/documents/${encodeURIComponent(id)}`,'GET',undefined,signal,{blob:true}))},
 async document(id,doc,signal){await guard(signal);return safeBlob(await client.reviewRequest(`/applications/${encodeURIComponent(id)}/documents/${encodeURIComponent(doc)}`,'GET',undefined,signal,{blob:true}))},
}
