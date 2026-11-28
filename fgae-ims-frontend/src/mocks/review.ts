import { authService } from './auth'
import { accounts } from './identities'
import { readApplication } from './application'
import { readWorkflow, type Workflow } from './correction-store'
import { readRegisteredIdentities, readReviewed, commitReview, applyAccessDirectory } from './credentials'
import { lockedOrganization, organizationBranches, organizationAreas } from './organization-store'
import { registrationConfig } from './registration'
import { readRegistrationItem, writeRegistrationItem } from './registration-store'
import { AreaError, canCreateArea } from '../services/contracts/areas'
import { canReview, canReviewBranch, validateDecision, type ReviewService, type ReviewRecord } from '../services/contracts/review'
import { RegistrationError, personalErrors, normalizePhone, validateDocument, type RegistrationDocument } from '../services/contracts/registration'
import type { Identity } from '../services/contracts/auth'
async function guard(signal?: AbortSignal) { signal?.throwIfAborted(); const i=await authService.restore(signal);if(!i)throw new AreaError('SESSION_EXPIRED');if(!canReview(i))throw new AreaError('FORBIDDEN');return i }
function records():ReviewRecord[] {
 const identities=new Map([...accounts,...readRegisteredIdentities()].map(i=>[i.id,i]))
 return [...identities.values()].flatMap(i=>{const application=readApplication(i);if(!application)return [];const reviewed=readReviewed(i.id)?.record;return [{application:{...application,branchName:organizationBranches().find(b=>b.id===application.fields.branchId)?.name??application.branchName},revision:readWorkflow(i.id)?.revision??application.history.length,source:reviewed?.source??'SELF',submittedBy:reviewed?.submittedBy??i.id,submittedByName:reviewed?.submittedByName??i.name,payment:'NOT_CONFIGURED',supervisorId:reviewed?.supervisorId??null}]})
}
function allowed(i:Identity,r:ReviewRecord){const b=organizationBranches().find(b=>b.id===r.application.fields.branchId);return !!b&&canReviewBranch(i,b)}
function workflow(r:ReviewRecord):Workflow { return readWorkflow(r.application.ownerId)??{application:r.application,revision:r.revision,draftVersion:0,draft:null,editableFields:[],documentTypes:[],config:structuredClone(registrationConfig),receipts:[]} }
function supervisors(){ return applyAccessDirectory(accounts.map(i=>({...i,state:i.accountState,grants:i.grants.map(g=>({...g,scopeName:g.scope.id}))}))).filter(i=>i.state==='ACTIVE'&&!i.mustChangePassword&&i.grants.some(g=>g.role==='FIELD_SUPERVISOR')).map(i=>({id:i.id,name:i.name,branchIds:organizationBranches().filter(b=>i.grants.some(g=>g.role==='FIELD_SUPERVISOR'&&(g.scope.kind==='global'&&g.scope.id==='*'||g.scope.kind==='branch'&&g.scope.id===b.id||g.scope.kind==='area'&&g.scope.id===b.areaId))).map(b=>b.id)})) }
type Upload={actorId?:string;ownerId?:string;applicationId?:string;doc:RegistrationDocument;blob:Blob}
async function attached(r:ReviewRecord,d:RegistrationDocument){
 const staff=await readRegistrationItem<Upload>(`review-file:${d.id}`)
 const correction=await readRegistrationItem<Upload>(`correction-file:${d.id}`)
 const original=await readRegistrationItem<Upload>(`file:${d.id}`)
 const f=staff?.actorId===r.submittedBy?staff:correction?.ownerId===r.application.ownerId&&correction.applicationId===r.application.id?correction:original
 if(!f||JSON.stringify(f.doc)!==JSON.stringify(d)||!f.blob||f.blob.size!==d.size||f.blob.type!==d.mime)throw new RegistrationError('DOCUMENT_MISSING')
 return f.blob
}
export const reviewService:ReviewService={
 async load(signal){const identity=await guard(signal);const branches=organizationBranches().filter(b=>canReviewBranch(identity,b));return {identity,records:records().filter(r=>allowed(identity,r)),branches,config:{...structuredClone(registrationConfig),branches:registrationConfig.branches.filter(b=>branches.some(x=>x.id===b.id))},supervisors:supervisors().map(s=>({...s,branchIds:s.branchIds.filter(id=>branches.some(b=>b.id===id))})).filter(s=>s.branchIds.length)}},
 async decide(input,signal){return lockedOrganization(async()=>{const actor=await guard(signal);return commitReview(actor,input.idempotencyKey,JSON.stringify(input),async()=>{
  const current=records().find(r=>r.application.id===input.id);if(!current||!allowed(actor,current))throw new AreaError('NOT_FOUND');if(current.submittedBy===actor.id)throw new AreaError('FORBIDDEN');validateDecision(input,current,registrationConfig)
  const record=structuredClone(current);const w=workflow(current);const app=record.application
  if(input.status==='APPROVED'){
   const assigned=organizationBranches().find(b=>b.id===input.branchId);if(!assigned||!canReviewBranch(actor,assigned))throw new AreaError('FORBIDDEN');if(input.supervisorId&&!supervisors().some(s=>s.id===input.supervisorId&&s.branchIds.includes(assigned.id)))throw new AreaError('VALIDATION')
   app.fields.branchId=assigned.id;app.branchName=assigned.name;record.supervisorId=input.supervisorId
   if(Object.keys(personalErrors(app.fields,registrationConfig)).length)throw new AreaError('VALIDATION')
   if(registrationConfig.documents.some(rule=>rule.required&&!app.documents.some(d=>d.typeId===rule.id)))throw new RegistrationError('DOCUMENT_MISSING')
   for(const d of app.documents)await attached(record,d)
  }
  app.status=input.status;app.updatedAt=new Date().toISOString();app.history.push({actorId:actor.id,id:crypto.randomUUID(),status:input.status,at:app.updatedAt,note:`${actor.name}: ${input.note.trim()||'Approved'}`});record.revision++
  w.versions=[...(w.versions??[]),{revision:current.revision,fields:structuredClone(current.application.fields),documents:structuredClone(current.application.documents)}];w.application=app;w.revision=record.revision;w.draft=null;w.draftVersion++;w.editableFields=input.editableFields;w.documentTypes=input.documentTypes
  return {record,workflow:w,staff:false}
 },()=>guard(signal),signal)})},
 async register(input,signal){return lockedOrganization(async()=>{const actor=await guard(signal);return commitReview(actor,input.idempotencyKey,JSON.stringify(input),async()=>{
  const branch=organizationBranches().find(b=>b.id===input.fields.branchId)
  if(!branch||!canReviewBranch(actor,branch))throw new AreaError('FORBIDDEN')
  if(branch.state!=='ACTIVE'||!organizationAreas().some(a=>a.id===branch.areaId&&a.state==='ACTIVE'))throw new AreaError('CONFLICT')
  if(!input.confirmed||!input.idempotencyKey||input.idempotencyKey.length>100||input.configVersion!==registrationConfig.version||Object.keys(personalErrors(input.fields,registrationConfig)).length)throw new AreaError('VALIDATION')
  if(input.supervisorId&&!supervisors().some(s=>s.id===input.supervisorId&&s.branchIds.includes(branch.id)))throw new AreaError('VALIDATION')
  if(new Set(input.documents.map(d=>d.typeId)).size!==input.documents.length||registrationConfig.documents.some(r=>r.required&&!input.documents.some(d=>d.typeId===r.id)))throw new RegistrationError('DOCUMENT_MISSING')
  for(const d of input.documents){const f=await readRegistrationItem<Upload>(`review-file:${d.id}`);const rule=registrationConfig.documents.find(r=>r.id===d.typeId);if(!f||f.actorId!==actor.id||JSON.stringify(f.doc)!==JSON.stringify(d)||!rule)throw new RegistrationError('DOCUMENT_MISSING');await validateDocument(new File([f.blob],d.name,{type:d.mime}),rule)}
  const at=new Date().toISOString();const ownerId=`synthetic-staff-${crypto.randomUUID()}`;const approved=canCreateArea(actor)
  const record:ReviewRecord={revision:approved?2:1,source:'STAFF',submittedBy:actor.id,submittedByName:actor.name,payment:'NOT_CONFIGURED',supervisorId:input.supervisorId,application:{id:crypto.randomUUID(),ownerId,status:approved?'APPROVED':'PENDING',submittedAt:at,updatedAt:at,branchName:branch.name,fields:{...input.fields,fullName:input.fields.fullName.trim(),email:input.fields.email.trim().toLowerCase(),phone:normalizePhone(input.fields.phone)},documents:input.documents,history:[{actorId:actor.id,id:crypto.randomUUID(),status:'PENDING',at,note:`Registered by ${actor.name}`},...(approved?[{actorId:actor.id,id:crypto.randomUUID(),status:'APPROVED' as const,at,note:`Direct registration by ${actor.name}`}]:[])]}}
  return {record,workflow:{...workflow(record),application:record.application,revision:record.revision},staff:true}
 },()=>guard(signal),signal)})},
 async upload(file,typeId,signal,progress){const actor=await guard(signal);const rule=registrationConfig.documents.find(r=>r.id===typeId);if(!rule)throw new AreaError('VALIDATION');await validateDocument(file,rule);const doc={id:crypto.randomUUID(),typeId,name:file.name,mime:file.type,size:file.size};if((await guard(signal)).id!==actor.id)throw new AreaError('SESSION_EXPIRED');await writeRegistrationItem(`review-file:${doc.id}`,{actorId:actor.id,doc,blob:file},signal);progress(100);return doc},
 async preview(id,signal){const actor=await guard(signal);const f=await readRegistrationItem<Upload>(`review-file:${id}`);if(!f||f.actorId!==actor.id)throw new AreaError('NOT_FOUND');signal.throwIfAborted();return f.blob},
 async document(id,documentId,signal){const actor=await guard(signal);const r=records().find(r=>r.application.id===id);const d=r?.application.documents.find(d=>d.id===documentId);if(!r||!d||!allowed(actor,r))throw new AreaError('NOT_FOUND');const blob=await attached(r,d);if((await guard(signal)).id!==actor.id)throw new AreaError('SESSION_EXPIRED');return blob},
}
