import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react'
import {facilityService} from '@facilities-adapter'
import {Accordion,AccordionSelect} from '../../components/Accordion'
import {AnimatedResults} from '../../components/AnimatedResults'
import {Button} from '../../components/Button'
import {SessionNotice} from '../../components/SessionNotice'
import {useLocale} from '../../i18n/locale'
import type {TranslationKey} from '../../i18n/locales/en/auth'
import {AreaError,canCreateArea} from '../../services/contracts/areas'
import {validateFacility,validateFacilityEdit,type Facility,type FacilityEditInput,type FacilityImpact,type FacilitySnapshot} from '../../services/contracts/facilities'
import {useOrganizationSession,organizationError} from './useOrganizationSession'
import {FacilityFacts} from './FacilityFacts'
export function FacilityEditor({facilityId}:{facilityId?:string}) {
 const {t}=useLocale()
 const loader=useCallback(async(signal:AbortSignal)=>{
  const data=await facilityService.load(signal);if(!canCreateArea(data.identity))throw new AreaError('FORBIDDEN')
  const record=data.snapshot.facilities.find(f=>f.id===facilityId);if(facilityId&&!record)throw new AreaError('NOT_FOUND')
  const impact=facilityId?await facilityService.impact(facilityId,signal):undefined
  if(impact&&impact.version!==record?.version)throw new AreaError('CONFLICT')
  return {...data,record,impact}
 },[facilityId])
 const {data,busy,error,load}=useOrganizationSession(loader)
 return <section className="workspace-page areas-page organization-editor motion-enter" aria-labelledby="facility-editor-heading">
 <a className="text-link" href={facilityId?`/facilities/${encodeURIComponent(facilityId)}`:'/facilities'}>{t(facilityId?'facilityView':'facilityBack')}</a>
 {!data&&<><h1 id="facility-editor-heading">{t(facilityId?'facilityEdit':'facilityCreate')}</h1>{busy&&<p role="status" className="session-check"><span className="spinner" aria-hidden="true"/>{t('facilityLoading')}</p>}{error==='homeSignInNote'?<SessionNotice/>:error&&<div className="feedback error" role="alert"><p>{t(error==='orgNotFound'?'facilityNotFound':error)}</p><Button className="secondary" disabled={busy} onClick={()=>void load()}>{t('appRetry')}</Button></div>}</>}
 {data&&<FacilityForm key={`${facilityId}:${data.record?.version}`} old={data.record} snapshot={data.snapshot} impact={data.impact} reload={load}/>}</section>
}
function FacilityForm({old,snapshot,impact,reload}:{old?:Facility;snapshot:FacilitySnapshot;impact?:FacilityImpact;reload:()=>Promise<void>}) {
 const {t}=useLocale();const editing=!!old
 const initial:FacilityEditInput={id:old?.id??'',version:old?.version??0,name:old?.name??'',code:old?.code??'',address:old?.address??'',branchId:old?.branchId??'',state:old?.state??'ACTIVE',reason:'',idempotencyKey:''}
 const [form,setForm]=useState(initial);const [review,setReview]=useState(false);const [confirmed,setConfirmed]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState<TranslationKey|null>(null);const [saved,setSaved]=useState<string|null>(null);const [blocked,setBlocked]=useState(false)
 const request=useRef<AbortController|null>(null);const flight=useRef(false);const operation=useRef<{payload:string;key:string}|null>(null);const leave=useRef(false);const feedback=useRef<HTMLDivElement>(null);const heading=useRef<HTMLHeadingElement>(null)
 const dirty=!saved&&!blocked&&JSON.stringify(form)!==JSON.stringify(initial)
 useEffect(()=>()=>request.current?.abort(),[])
 useEffect(()=>{if(error)feedback.current?.focus({preventScroll:true})},[error])
 useEffect(()=>{if(!dirty)return;const before=(e:BeforeUnloadEvent)=>{if(!leave.current){e.preventDefault();e.returnValue=''}};const click=(e:MouseEvent)=>{if(e.defaultPrevented||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;const a=(e.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');if(!a||a.hash&&a.pathname===location.pathname)return;if(window.confirm(t('orgUnsaved')))leave.current=true;else e.preventDefault()};window.addEventListener('beforeunload',before);document.addEventListener('click',click);return()=>{window.removeEventListener('beforeunload',before);document.removeEventListener('click',click)}},[dirty,t])
 const change=(key:keyof FacilityEditInput,value:string)=>{setForm(f=>({...f,[key]:value}));setError(null);setConfirmed(false);leave.current=false}
 const activeBranches=snapshot.branches.filter(b=>b.state==='ACTIVE'&&snapshot.areas.some(a=>a.id===b.areaId&&a.state==='ACTIVE'))
 const parents=snapshot.branches.filter(b=>activeBranches.some(a=>a.id===b.id)||old?.branchId===b.id)
 const blockedParent=!activeBranches.some(b=>b.id===form.branchId)&&(!old||form.state==='ACTIVE'||form.branchId!==old.branchId)
 const blockedArchive=!!old&&!!impact&&old.state==='ACTIVE'&&form.state==='ARCHIVED'&&(impact.activeAssignments>0||impact.pendingAttendance>0)
 const blockedMove=!!old&&!!impact&&form.branchId!==old.branchId&&(impact.linkedRecords>0||form.state!==old.state)
 async function submit(e:FormEvent){e.preventDefault();if(flight.current||blocked)return
  let next;try{next=editing?validateFacilityEdit({...form,idempotencyKey:'validation'}):validateFacility({...form,idempotencyKey:'validation'})}catch{setError('facilityValidation');return}
  if(blockedParent||blockedArchive||blockedMove){setError('facilityImpactBlocked');return}
  if(!review){setForm(f=>({...f,...next,idempotencyKey:''}));setReview(true);setConfirmed(false);setError(null);requestAnimationFrame(()=>heading.current?.focus({preventScroll:true}));return}
  if(!confirmed)return
  const payload=JSON.stringify(next);if(operation.current?.payload!==payload)operation.current={payload,key:crypto.randomUUID()}
  const controller=new AbortController();request.current=controller;flight.current=true;setBusy(true);setError(null)
  try{const result=editing?await facilityService.update({...next,idempotencyKey:operation.current.key} as FacilityEditInput,controller.signal):await facilityService.create({...next,idempotencyKey:operation.current.key},controller.signal);if(!controller.signal.aborted){setSaved(result.id);requestAnimationFrame(()=>heading.current?.focus({preventScroll:true}))}}
  catch(failure){if(!controller.signal.aborted){const message=organizationError(failure);setError(message==='orgDuplicate'?'facilityDuplicate':message==='orgImpactBlocked'?'facilityImpactBlocked':message);if(message==='homeSignInNote'||message==='mgrDeniedNote'){setBlocked(true);setForm({...initial,name:'',code:'',address:'',reason:''})}}}
  finally{flight.current=false;if(!controller.signal.aborted)setBusy(false)}
 }
 return <><div className="application-heading"><div><p className="eyebrow">{t('orgScope')}</p><h1 id="facility-editor-heading" tabIndex={-1} ref={heading}>{t(saved?editing?'facilityUpdated':'facilitySaved':review?editing?'orgReviewChanges':'facilityReview':editing?'facilityEdit':'facilityCreate')}</h1><p className="form-subtitle">{t(editing?'facilityEditIntro':'facilityCreateIntro')}</p></div></div>
 {error==='homeSignInNote'?<SessionNotice ref={feedback}/>:error&&<div ref={feedback} tabIndex={-1} role="alert" className="feedback error"><p>{t(error)}</p><Button className="secondary" disabled={busy} onClick={()=>{if(!dirty||window.confirm(t('orgUnsaved')))void reload()}}>{t('orgReload')}</Button></div>}
 {busy&&<p role="status" className="session-check"><span className="spinner" aria-hidden="true"/>{t('orgWorking')}</p>}
 {saved?<section className="application-card"><h2>{form.name}</h2><p>{t(editing?'facilityUpdated':'facilitySaved')}</p><a className="primary action-link" href={`/facilities/${encodeURIComponent(saved)}`}>{t('facilityView')}</a></section>:!blocked&&<form onSubmit={e=>void submit(e)} noValidate aria-busy={busy}><AnimatedResults changeKey={String(review)}><section className="application-card">
 {review?<>{old&&<Accordion id="facility-before" label={t('uaBefore')}><FacilityFacts value={old} snapshot={snapshot}/></Accordion>}<h2>{t('uaAfter')}</h2><FacilityFacts value={form} snapshot={snapshot}/><h3>{t(editing?'orgChangeReason':'orgReason')}</h3><p className="area-description">{form.reason}</p><div className="area-confirm"><input id="facility-confirm" type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/><label htmlFor="facility-confirm">{t('orgChangeConfirm')}</label></div></>:<>
 <div className="field"><label htmlFor="facility-name">{t('facilityName')}</label><input id="facility-name" maxLength={120} required disabled={busy} value={form.name} onChange={e=>change('name',e.target.value)}/></div>
 <div className="field"><label htmlFor="facility-code">{t('facilityCode')}</label><input id="facility-code" maxLength={20} required disabled={busy} value={form.code} aria-describedby="facility-code-help" onChange={e=>change('code',e.target.value)}/><p className="field-help" id="facility-code-help">{t('orgCodeHelp')}</p></div>
 <div className="field"><label htmlFor="facility-address">{t('facilityAddress')}</label><textarea id="facility-address" rows={3} maxLength={300} disabled={busy} value={form.address} onChange={e=>change('address',e.target.value)}/></div>
 <div className="field"><AccordionSelect id="facility-parent" label={t('facilityBranch')} value={form.branchId} disabled={busy||!parents.length} options={[{value:'',label:t('facilityChoose')},...parents.map(b=>({value:b.id,label:`${b.name} — ${snapshot.areas.find(a=>a.id===b.areaId)?.name}`}))]} onChange={value=>change('branchId',value)}/>{!activeBranches.length&&<p className="field-help">{t('facilityNoBranches')}</p>}</div>
 {editing&&<div className="field"><AccordionSelect id="facility-state" label={t('facilityStatus')} value={form.state} disabled={busy} options={[{value:'ACTIVE',label:t('orgActive')},{value:'ARCHIVED',label:t('orgArchived')}]} onChange={value=>change('state',value)}/></div>}
 <div className="field"><label htmlFor="facility-reason">{t(editing?'orgChangeReason':'orgReason')}</label><textarea id="facility-reason" rows={3} maxLength={500} required disabled={busy} value={form.reason} aria-describedby="facility-reason-help" onChange={e=>change('reason',e.target.value)}/><p className="field-help" id="facility-reason-help">{t('orgReasonHelp')}</p></div></>}
 {impact&&<Accordion id="facility-impact" label={t('branchImpact')} initialOpen><p>{t('facilityImpactNote')}</p><dl className="portfolio-facts">{([['facilityActiveAssignments',impact.activeAssignments],['facilityPendingAttendance',impact.pendingAttendance],['branchReferences',impact.linkedRecords]] as const).map(([key,count])=><div key={key}><dt>{t(key)}</dt><dd>{count}</dd></div>)}</dl>{(blockedArchive||blockedMove||!!form.branchId&&blockedParent)&&<p role="status" className="feedback error">{t('facilityImpactBlocked')}</p>}</Accordion>}
 <div className="access-actions">{review&&<Button className="secondary" disabled={busy} onClick={()=>{setReview(false);setConfirmed(false);setError(null)}}>{t('orgEditForm')}</Button>}<Button className="primary" type="submit" disabled={busy||blockedArchive||blockedMove||!!form.branchId&&blockedParent||review&&!confirmed||!old&&!activeBranches.length}>{t(review?editing?'orgSaveChanges':'facilityCreate':editing?'orgReviewChanges':'facilityReview')}</Button></div>
 </section></AnimatedResults></form>}</>
}
