import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowClockwiseIcon, ArrowRightIcon, BuildingsIcon, CheckCircleIcon, ClockIcon, GearSixIcon, SignOutIcon, UsersThreeIcon, ClipboardTextIcon, MapPinIcon } from '@phosphor-icons/react'
import { managerOverviewService } from '@manager-overview-adapter'
import { authService } from '@auth-adapter'
import { Button } from '../../components/Button'
import { useLocale } from '../../i18n/locale'
import type { TranslationKey } from '../../i18n/locales/en/auth'
import type { ManagerKind, ManagerSnapshot } from '../../services/contracts/manager-overview'
const pageCopy = {
  'area-manager': { title: 'areaHeading', eyebrow: 'areaEyebrow', intro: 'areaIntro', welcome: 'areaWelcome', work: 'areaWork' },
  'branch-manager': { title: 'branchHeading', eyebrow: 'branchEyebrow', intro: 'branchIntro', welcome: 'branchWelcome', work: 'branchWork' },
  'volunteer-manager': { title: 'vmHeading', eyebrow: 'vmEyebrow', intro: 'vmIntro', welcome: 'vmWelcome', work: 'vmWork' },
} as const
const workStates = { PLANNED: 'mgrPlanned', ACTIVE: 'mgrActive', COMPLETED: 'mgrCompleted', CANCELLED: 'mgrCancelled' } as const
const applicationStates = { PENDING: 'appPending', RETURNED: 'appReturned', APPROVED: 'appApproved', REJECTED: 'appRejected' } as const
export function ManagerOverview({ kind }: { kind: ManagerKind }) {
  const { t, locale } = useLocale()
  const copy = pageCopy[kind]
  const [snapshot, setSnapshot] = useState<ManagerSnapshot | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<TranslationKey | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const request = useRef<AbortController | null>(null)
  const invalidated = useRef(false); const loggingOut = useRef(false)
  const load = useCallback(async (focus = false) => {
    if (invalidated.current || loggingOut.current) return
    request.current?.abort(); const controller = new AbortController(); request.current = controller
    setBusy(true); setError(null); setSnapshot(null)
    try { const result = await managerOverviewService.load(kind, controller.signal); if (!controller.signal.aborted) setSnapshot(result) }
    catch (value) {
      if (!controller.signal.aborted) {
        const code = value instanceof Error && 'code' in value ? String(value.code) : ''
        setError(code === 'SESSION_EXPIRED' ? 'mgrSignIn' : code === 'FORBIDDEN' ? 'mgrDenied' : code === 'NETWORK' || code === 'RATE_LIMITED' || code === 'STORAGE_UNAVAILABLE' ? code : 'mgrUnavailable')
      }
    } finally { if (!controller.signal.aborted) { setBusy(false); if (focus) requestAnimationFrame(() => { if (!controller.signal.aborted) heading.current?.focus() }) } }
  }, [kind])
  useEffect(() => {
    let mounted = true; void Promise.resolve().then(() => { if (mounted) void load() })
    const verify = () => { if (!document.hidden) void load() }
    const timer = window.setInterval(verify, 60_000); window.addEventListener('focus', verify)
    const bus = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('fgae.auth') : null
    if (bus) bus.onmessage = () => { invalidated.current = true; request.current?.abort(); setSnapshot(null); setBusy(false); setError('mgrSignIn') }
    return () => { mounted = false; request.current?.abort(); clearInterval(timer); window.removeEventListener('focus', verify); bus?.close() }
  }, [load])
  useEffect(() => { if (error) heading.current?.focus() }, [error])
  async function signOut() {
    if (loggingOut.current) return
    loggingOut.current = true; request.current?.abort(); setSigningOut(true); setSnapshot(null); setBusy(false)
    try { await authService.signOut(); invalidated.current = true; setError('mgrSignIn'); const bus = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('fgae.auth') : null; bus?.postMessage('signed-out'); bus?.close() }
    catch { setError('logoutFailed') } finally { loggingOut.current = false; setSigningOut(false) }
  }
  const data = snapshot?.overview
  const gate = error === 'mgrSignIn' || error === 'mgrDenied'
  const date = (value: string) => new Intl.DateTimeFormat(locale, { calendar: 'gregory', timeZone: 'Africa/Addis_Ababa', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  const number = (value: number) => new Intl.NumberFormat(locale).format(value)
  const location = (id: string) => data?.locations.find(item => item.id === id)?.name
  const metrics = data ? kind === 'volunteer-manager' ? [
    { label: 'homePending', note: 'homePendingNote', value: data.counts.pending, icon: ClockIcon },
    { label: 'homeReturned', note: 'homeReturnedNote', value: data.counts.returned, icon: ClipboardTextIcon },
    { label: 'mgrVolunteers', note: 'mgrVolunteerNote', value: data.counts.volunteers, icon: UsersThreeIcon },
    { label: 'mgrAttendance', note: 'mgrAttendanceNote', value: data.counts.attendance, icon: CheckCircleIcon },
  ] as const : [
    { label: 'mgrWorkTotal', note: 'mgrWorkNote', value: data.counts.work, icon: ClipboardTextIcon },
    { label: 'mgrActiveWork', note: 'mgrActiveNote', value: data.counts.active, icon: ClockIcon },
    { label: kind === 'area-manager' ? 'mgrAllocation' : 'mgrUnfilled', note: kind === 'area-manager' ? 'mgrAllocationNote' : 'mgrUnfilledNote', value: kind === 'area-manager' ? data.counts.allocation : data.counts.unfilled, icon: MapPinIcon },
    { label: 'mgrVolunteers', note: 'mgrVolunteerNote', value: data.counts.volunteers, icon: UsersThreeIcon },
  ] as const : []
  const followups: { label: TranslationKey; note: TranslationKey; value: number }[] = data ? kind === 'volunteer-manager' ? [
    { label: 'homePending', note: 'homePendingAction', value: data.counts.pending }, { label: 'homeReturned', note: 'homeReturnedAction', value: data.counts.returned },
    { label: 'mgrInactive', note: 'mgrInactiveNote', value: data.counts.inactiveVolunteers },
  ] : [
    ...(kind === 'area-manager' ? [{ label: 'mgrAllocation' as const, note: 'mgrAllocationNote' as const, value: data.counts.allocation }] : []),
    { label: 'mgrUnfilled', note: 'mgrUnfilledNote', value: data.counts.unfilled },
    { label: 'mgrSupervision', note: 'mgrSupervisionNote', value: data.counts.supervision },
    { label: 'mgrAttendance', note: 'mgrAttendanceNote', value: data.counts.attendance },
  ] : []
  return <section className="workspace-page manager-page motion-enter" aria-labelledby="manager-heading" aria-busy={busy || signingOut}>
    <div className="workspace-topline"><a href="/sign-in" className="text-link">{t('appAccount')}</a><span className="workspace-scope"><BuildingsIcon size={17} aria-hidden="true" />{t('mgrScope')}</span></div>
    <div className="application-heading"><div><p className="eyebrow">{t(copy.eyebrow)}</p><h1 id="manager-heading" ref={heading} tabIndex={-1}>{t(gate ? error : copy.title)}</h1><p className="form-subtitle">{t(error === 'mgrSignIn' ? 'homeSignInNote' : error === 'mgrDenied' ? 'mgrDeniedNote' : copy.intro)}</p></div>{snapshot && <div className="workspace-controls"><Button className="secondary" onClick={() => void load(true)}><ArrowClockwiseIcon size={18} aria-hidden="true" />{t('homeRefresh')}</Button><Button className="secondary" onClick={() => void signOut()}><SignOutIcon size={18} aria-hidden="true" />{t('signOut')}</Button></div>}</div>
    {busy || signingOut ? <p className="session-check" role="status"><span className="spinner" aria-hidden="true" />{t(signingOut ? 'signingOut' : 'mgrLoading')}</p> : error ? <div className="application-state" role={gate ? 'status' : 'alert'}>{!gate && <><h2>{t('homeError')}</h2><p>{t(error)}</p></>}{gate ? <a href="/sign-in" className="primary action-link">{t(error === 'mgrDenied' ? 'appAccount' : 'signIn')}</a> : <Button className="primary" onClick={() => void load(true)}>{t('appRetry')}</Button>}</div> : data && snapshot && <>
      <nav className="workspace-nav" aria-label={t('homeNav')}><a href={`/workspaces/${kind}`} aria-current="page">{t('homeOverview')}</a><a href="/account"><GearSixIcon size={18} aria-hidden="true" />{t('acctHeading')}</a></nav>
      <div className="workspace-banner"><div><p className="eyebrow">{snapshot.identity.name}</p><h2>{t(copy.welcome)}</h2><p>{t('mgrWelcomeNote')}</p></div><BuildingsIcon size={92} weight="duotone" className="workspace-art" aria-hidden="true" /></div>
      <dl className="workspace-metrics motion-stagger">{metrics.map(metric => <div className="workspace-metric" key={metric.label}><dt><metric.icon size={23} aria-hidden="true" />{t(metric.label)}</dt><dd className="workspace-value">{number(metric.value)}</dd><dd className="workspace-metric-note">{t(metric.note)}</dd></div>)}</dl>
      <div className="workspace-columns"><section className="application-card workspace-attention" aria-labelledby="manager-attention"><h2 id="manager-attention">{t('mgrAttention')}</h2><p className="step-intro">{t('mgrAttentionNote')}</p>{followups.some(item => item.value > 0) ? <ul>{followups.filter(item => item.value > 0).map(item => <li key={item.label}><span className="workspace-count">{number(item.value)}</span><div><h3>{t(item.label)}</h3><p>{t(item.note)}</p></div></li>)}</ul> : <div className="workspace-empty"><CheckCircleIcon size={28} aria-hidden="true" /><h3>{t('mgrClear')}</h3><p>{t('mgrClearNote')}</p></div>}</section>
      <aside className="application-card workspace-account"><GearSixIcon size={25} aria-hidden="true" /><h2>{t('acctHeading')}</h2><p>{t('homeAccountNote')}</p><a href="/account" className="text-link">{t('homeOpenAccount')}<ArrowRightIcon size={18} aria-hidden="true" /></a></aside></div>
      <section className="application-card manager-section" aria-labelledby="manager-coverage"><h2 id="manager-coverage">{t('mgrCoverage')}</h2><p className="step-intro">{t('mgrCoverageNote')}</p>{data.locations.length ? <ul className="manager-locations">{data.locations.map(item => <li key={item.id}><BuildingsIcon size={18} aria-hidden="true" /><span>{item.name}<small>{t(item.kind === 'area' ? 'mgrArea' : 'mgrBranch')}</small></span></li>)}</ul> : <p>{t('mgrNoCoverage')}</p>}</section>
      {kind === 'volunteer-manager' && <section className="application-card manager-section" aria-labelledby="manager-applications"><h2 id="manager-applications">{t('homeRecent')}</h2><p className="step-intro">{t('mgrApplicationNote')}</p>{data.applications.length ? <ul className="workspace-records manager-applications">{data.applications.map(item => <li key={item.id}><div><h3>{item.name}</h3><p>{location(item.locationId)}</p></div><span className={`workspace-badge badge-${item.state.toLowerCase()}`}>{t(applicationStates[item.state])}</span><time dateTime={item.updatedAt}>{date(item.updatedAt)}</time></li>)}</ul> : <p className="workspace-empty">{t('homeEmpty')}</p>}</section>}
      <section className="application-card manager-section" aria-labelledby="manager-work"><h2 id="manager-work">{t(copy.work)}</h2><p className="step-intro">{t('mgrRecentWorkNote')}</p>{data.work.length ? <ul className="manager-work">{data.work.map(item => <li key={item.id}><div className="manager-work-heading"><div><h3>{item.title}</h3><p>{location(item.locationId)}</p></div><span className={`workspace-badge ${item.state === 'COMPLETED' ? 'badge-approved' : ''}`}>{t(workStates[item.state])}</span></div><dl><div><dt>{t('mgrDue')}</dt><dd><time dateTime={item.dueAt}>{date(item.dueAt)}</time></dd></div><div><dt>{t('mgrAssigned')}</dt><dd>{number(item.assigned)} / {number(item.target)}</dd></div><div><dt>{t('mgrAttendance')}</dt><dd>{number(item.attendancePending)}</dd></div></dl>{item.needsAllocation && <p className="manager-followup">{t('mgrAllocation')}</p>}{item.needsSupervisor && <p className="manager-followup">{t('mgrSupervision')}</p>}</li>)}</ul> : <div className="workspace-empty"><ClipboardTextIcon size={28} aria-hidden="true" /><h3>{t('mgrNoWork')}</h3><p>{t('mgrNoWorkNote')}</p></div>}</section>
      <section className="application-card manager-section" aria-labelledby="manager-volunteers"><h2 id="manager-volunteers">{t('mgrPeople')}</h2><p className="step-intro">{t('mgrPeopleNote')}</p>{data.volunteers.length ? <ul className="workspace-records manager-volunteers">{data.volunteers.map(item => <li key={item.id}><div><h3>{item.name}</h3><p>{location(item.locationId)}</p></div><span className={`workspace-badge ${item.state === 'ACTIVE' ? 'badge-approved' : ''}`}>{t(item.state === 'ACTIVE' ? 'mgrActiveVolunteer' : 'mgrInactive')}</span><time dateTime={item.updatedAt}>{date(item.updatedAt)}</time></li>)}</ul> : <p className="workspace-empty">{t('mgrNoPeople')}</p>}<p className="workspace-footnote">{t('mgrReadOnly')}</p></section>
      <p className="workspace-checked" role="status">{t('homeChecked')}: <time dateTime={data.generatedAt}>{date(data.generatedAt)}</time></p>
    </>}
  </section>
}
