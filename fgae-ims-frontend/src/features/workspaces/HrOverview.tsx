import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowClockwiseIcon, ArrowRightIcon, BuildingsIcon, CheckCircleIcon, IdentificationCardIcon, BriefcaseIcon, ClockIcon, GearSixIcon, SquaresFourIcon, SignOutIcon, UsersThreeIcon } from '@phosphor-icons/react'
import { hrOverviewService } from '@hr-overview-adapter'
import { authService } from '@auth-adapter'
import { Button } from '../../components/Button'
import { useLocale } from '../../i18n/locale'
import type { TranslationKey } from '../../i18n/locales/en/auth'
import type { HrSnapshot } from '../../services/contracts/hr-overview'
const employmentLabels = { ACTIVE: 'hrActive', ON_LEAVE: 'hrLeave', ENDED: 'hrEnded' } as const
const accountLabels = { ACTIVE: 'hrAccountActive', SUSPENDED: 'hrAccountSuspended', NONE: 'hrAccountNone' } as const
export function HrOverview() {
  const { t, locale } = useLocale()
  const [snapshot, setSnapshot] = useState<HrSnapshot | null>(null)
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
    try { const result = await hrOverviewService.load(controller.signal); if (!controller.signal.aborted) setSnapshot(result) }
    catch (value) {
      if (!controller.signal.aborted) {
        const code = value instanceof Error && 'code' in value ? String(value.code) : ''
        setError(code === 'SESSION_EXPIRED' ? 'hrSignIn' : code === 'FORBIDDEN' ? 'hrDenied' : code === 'NETWORK' || code === 'RATE_LIMITED' || code === 'STORAGE_UNAVAILABLE' ? code : 'hrUnavailable')
      }
    } finally { if (!controller.signal.aborted) { setBusy(false); if (focus) requestAnimationFrame(() => { if (!controller.signal.aborted) heading.current?.focus() }) } }
  }, [])
  useEffect(() => {
    let mounted = true; void Promise.resolve().then(() => { if (mounted) void load() })
    const verify = () => { if (!document.hidden) void load() }
    const timer = window.setInterval(verify, 60_000); window.addEventListener('focus', verify)
    const bus = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('fgae.auth') : null
    if (bus) bus.onmessage = () => { invalidated.current = true; request.current?.abort(); setSnapshot(null); setBusy(false); setError('hrSignIn') }
    return () => { mounted = false; request.current?.abort(); clearInterval(timer); window.removeEventListener('focus', verify); bus?.close() }
  }, [load])
  useEffect(() => { if (error) heading.current?.focus() }, [error])
  async function signOut() {
    if (loggingOut.current) return
    loggingOut.current = true; request.current?.abort(); setSigningOut(true); setSnapshot(null); setBusy(false)
    try { await authService.signOut(); invalidated.current = true; setError('hrSignIn'); const bus = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('fgae.auth') : null; bus?.postMessage('signed-out'); bus?.close() }
    catch { setError('logoutFailed') } finally { loggingOut.current = false; setSigningOut(false) }
  }
  const data = snapshot?.overview
  const gate = error === 'hrSignIn' || error === 'hrDenied'
  const date = (value: string) => new Intl.DateTimeFormat(locale, { calendar: 'gregory', timeZone: 'Africa/Addis_Ababa', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  const number = (value: number) => new Intl.NumberFormat(locale).format(value)
  const metrics = data ? [
    { label: 'hrTotal', note: 'hrTotalNote', value: data.counts.total, icon: UsersThreeIcon },
    { label: 'hrActive', note: 'hrActiveNote', value: data.counts.active, icon: BriefcaseIcon },
    { label: 'hrLeave', note: 'hrLeaveNote', value: data.counts.onLeave, icon: ClockIcon },
    { label: 'hrLocations', note: 'hrLocationsNote', value: data.branches.length, icon: BuildingsIcon },
  ] as const : []
  return <section className="workspace-page hr-page motion-enter" aria-labelledby="hr-heading" aria-busy={busy || signingOut}>
    <div className="workspace-topline"><a className="text-link" href="/sign-in">{t('appAccount')}</a><span className="workspace-scope"><BuildingsIcon size={17} aria-hidden="true" />{t('hrScope')}</span></div>
    <div className="application-heading"><div><p className="eyebrow">{t('hrEyebrow')}</p><h1 id="hr-heading" ref={heading} tabIndex={-1}>{t(gate ? error : 'hrHeading')}</h1><p className="form-subtitle">{t(error === 'hrSignIn' ? 'homeSignInNote' : error === 'hrDenied' ? 'hrDeniedNote' : 'hrIntro')}</p></div>
      {snapshot && <div className="workspace-controls"><Button className="secondary" onClick={() => void load(true)}><ArrowClockwiseIcon size={18} aria-hidden="true" />{t('homeRefresh')}</Button><Button className="secondary" onClick={() => void signOut()}><SignOutIcon size={18} aria-hidden="true" />{t('signOut')}</Button></div>}
    </div>
    {busy || signingOut ? <p className="session-check" role="status"><span className="spinner" aria-hidden="true" />{t(signingOut ? 'signingOut' : 'hrLoading')}</p> : error ? <div className="application-state" role={gate ? 'status' : 'alert'}>{!gate && <><h2>{t('homeError')}</h2><p>{t(error)}</p></>}{gate ? <a className="primary action-link" href="/sign-in">{t(error === 'hrDenied' ? 'appAccount' : 'signIn')}</a> : <Button className="primary" onClick={() => void load(true)}>{t('appRetry')}</Button>}</div> : data && snapshot && <>
      <nav className="workspace-nav" aria-label={t('homeNav')}><a href="/workspaces/hr" aria-current="page"><SquaresFourIcon size={19} aria-hidden="true" />{t('homeOverview')}</a><a href="/account"><GearSixIcon size={19} aria-hidden="true" />{t('acctHeading')}</a></nav>
      <div className="workspace-banner"><div><p className="eyebrow">{snapshot.identity.name}</p><h2>{t('hrWelcome')}</h2><p>{t('hrWelcomeNote')}</p></div><UsersThreeIcon className="workspace-art" size={92} weight="duotone" aria-hidden="true" /></div>
      <dl className="workspace-metrics motion-stagger">{metrics.map(metric => <div className="workspace-metric" key={metric.label}><dt><metric.icon size={23} aria-hidden="true" />{t(metric.label)}</dt><dd className="workspace-value">{number(metric.value)}</dd><dd className="workspace-metric-note">{t(metric.note)}</dd></div>)}</dl>
      <div className="workspace-columns"><section className="application-card workspace-attention" aria-labelledby="hr-attention"><h2 id="hr-attention">{t('hrAttention')}</h2><p className="step-intro">{t('hrAttentionNote')}</p>
        {data.counts.needsContact || data.counts.needsJob ? <ul>{data.counts.needsContact > 0 && <li><span className="workspace-count">{number(data.counts.needsContact)}</span><div><h3>{t('hrContact')}</h3><p>{t('hrContactNote')}</p></div></li>}{data.counts.needsJob > 0 && <li><span className="workspace-count">{number(data.counts.needsJob)}</span><div><h3>{t('hrJob')}</h3><p>{t('hrJobNote')}</p></div></li>}</ul> : <div className="workspace-empty"><CheckCircleIcon size={28} aria-hidden="true" /><h3>{t('hrClear')}</h3><p>{t('hrClearNote')}</p></div>}
      </section><aside className="application-card workspace-account"><GearSixIcon size={25} aria-hidden="true" /><h2>{t('acctHeading')}</h2><p>{t('homeAccountNote')}</p><a className="text-link" href="/account">{t('homeOpenAccount')}<ArrowRightIcon size={18} aria-hidden="true" /></a></aside></div>
      <section className="application-card hr-scope-card" aria-labelledby="hr-coverage"><h2 id="hr-coverage">{t('hrCoverage')}</h2><p className="step-intro">{t('hrCoverageNote')}</p>{data.branches.length ? <ul className="hr-branches">{data.branches.map(branch => <li key={branch.id}><BuildingsIcon size={18} aria-hidden="true" />{branch.name}</li>)}</ul> : <p>{t('hrNoLocations')}</p>}</section>
      <section className="application-card workspace-recent" aria-labelledby="hr-recent"><h2 id="hr-recent">{t('hrRecent')}</h2><p className="step-intro">{t('hrRecentNote')}</p>
        {data.recent.length ? <ul className="workspace-records hr-records">{data.recent.map(record => <li key={record.id}><div className="workspace-person"><span className="workspace-initial" aria-hidden="true">{Array.from(record.name)[0]}</span><div><h3>{record.name}</h3><p>{record.jobTitle || t('hrJobMissing')}</p><p>{data.branches.find(branch => branch.id === record.branchId)?.name}</p></div></div><div className="hr-record-status"><span className={`workspace-badge ${record.employment === 'ACTIVE' ? 'badge-approved' : record.employment === 'ON_LEAVE' ? 'badge-returned' : ''}`}><span className="sr-only">{t('hrEmployment')}: </span>{t(employmentLabels[record.employment])}</span><p>{t(accountLabels[record.account])}</p>{(record.needsContact || record.needsJob) && <p className="hr-followup">{t('hrFollowup')}</p>}</div><time dateTime={record.updatedAt}><span className="sr-only">{t('homeUpdated')}: </span>{date(record.updatedAt)}</time></li>)}</ul> : <div className="workspace-empty"><IdentificationCardIcon size={30} aria-hidden="true" /><h3>{t('hrEmpty')}</h3><p>{t('hrEmptyNote')}</p></div>}
        <p className="workspace-footnote">{t('hrReadOnly')} {t('hrEnded')}: {number(data.counts.ended)}</p>
      </section><p className="workspace-checked" role="status">{t('homeChecked')}: <time dateTime={data.generatedAt}>{date(data.generatedAt)}</time></p>
    </>}
  </section>
}
