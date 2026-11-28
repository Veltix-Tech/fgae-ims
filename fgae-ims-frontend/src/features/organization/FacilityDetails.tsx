import {facilityService} from '@facilities-adapter'
import {Accordion} from '../../components/Accordion'
import {Button} from '../../components/Button'
import {DirectoryToolbar} from '../../components/DirectoryToolbar'
import {SessionNotice} from '../../components/SessionNotice'
import {useLocale} from '../../i18n/locale'
import {canCreateArea} from '../../services/contracts/areas'
import {useOrganizationSession} from './useOrganizationSession'
import {FacilityFacts} from './FacilityFacts'
export function FacilityDetails({facilityId}:{facilityId:string}) {
 const {t,locale}=useLocale();const {data,busy,error,load}=useOrganizationSession(facilityService.load);const facility=data?.snapshot.facilities.find(f=>f.id===facilityId)
 const date=(at:string)=>new Intl.DateTimeFormat(locale,{calendar:'gregory',timeZone:'Africa/Addis_Ababa',dateStyle:'medium',timeStyle:'short'}).format(new Date(at))
 return <section className="workspace-page areas-page motion-enter" aria-labelledby="facility-detail-heading">
  <a className="text-link" href="/facilities">{t('facilityBack')}</a>
  <div className="application-heading"><div><p className="eyebrow">{t('orgScope')}</p><h1 id="facility-detail-heading">{t('facilityDetail')}</h1><p className="form-subtitle">{t('facilityDetailIntro')}</p></div></div>
  {busy&&<p className="session-check" role="status"><span className="spinner" aria-hidden="true"/>{t('facilityLoading')}</p>}
  {error==='homeSignInNote'?<SessionNotice/>:error&&<div className="feedback error" role="alert"><p>{t(error)}</p><Button className="secondary" disabled={busy} onClick={()=>void load()}>{t('appRetry')}</Button></div>}
  {data&&(facility?<><section className="application-card"><DirectoryToolbar href={canCreateArea(data.identity)?`/facilities/${encodeURIComponent(facility.id)}/edit`:undefined} label={t('facilityEdit')}><h2>{facility.name}</h2></DirectoryToolbar><FacilityFacts value={facility} snapshot={data.snapshot}/><p>{t('orgCreated')}: <time dateTime={facility.createdAt}>{date(facility.createdAt)}</time></p>{!canCreateArea(data.identity)&&<p className="workspace-badge">{t('orgReadOnly')}</p>}</section>
  <section className="application-card manager-section"><Accordion id="facility-history" label={t('orgHistoryAll')} initialOpen>{facility.history.length?[...facility.history].reverse().map(h=><article className="access-audit" key={h.id}><h3>{t(h.action==='CREATE'?'facilitySaved':h.action==='UPDATE'?'facilityAuditUpdate':h.action==='ARCHIVE'?'facilityAuditArchive':h.action==='RESTORE'?'facilityAuditRestore':'facilityAuditMove')}</h3><p>{h.actor} · <time dateTime={h.at}>{date(h.at)}</time></p><p>{h.reason}</p>{h.before&&h.after&&<Accordion id={`facility-audit-${h.id}`} label={`${t('uaBefore')} / ${t('uaAfter')}`}><h4>{t('uaBefore')}</h4><FacilityFacts value={h.before} snapshot={data.snapshot}/><h4>{t('uaAfter')}</h4><FacilityFacts value={h.after} snapshot={data.snapshot}/></Accordion>}</article>):<p>{t('facilityNoHistory')}</p>}</Accordion></section></>:<p className="feedback" role="status">{t('facilityNotFound')}</p>)}
 </section>
}
