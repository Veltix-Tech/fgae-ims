import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowClockwiseIcon, ArrowRightIcon, BuildingsIcon, CheckCircleIcon, ClipboardTextIcon, ClockIcon, GearSixIcon, SquaresFourIcon, SignOutIcon, ArrowUUpLeftIcon } from '@phosphor-icons/react'
import { overviewService } from '@overview-adapter'
import { authService } from '@auth-adapter'
import { Button } from '../../components/Button'
import { useLocale } from '../../i18n/locale'
import type { TranslationKey } from '../../i18n/locales/en/auth'
import { applicationStates, type OverviewSnapshot } from '../../services/contracts/overview'
const statusLabels = { PENDING: 'appPending', RETURNED: 'appReturned', APPROVED: 'appApproved', REJECTED: 'appRejected' } as const
export function SuperAdmin() {
  const { t, locale } = useLocale()
  const [snapshot, setSnapshot] = useState<OverviewSnapshot | null>(null)
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
    try { const result = await overviewService.load(controller.signal); if (!controller.signal.aborted) setSnapshot(result) }
    catch (value) {
      if (!controller.signal.aborted) {
        const code = value instanceof Error && 'code' in value ? String(value.code) : ''
        setError(code === 'SESSION_EXPIRED' ? 'homeSignIn' : code === 'FORBIDDEN' ? 'homeDenied' : code === 'NETWORK' || code === 'RATE_LIMITED' || code === 'STORAGE_UNAVAILABLE' ? code : 'homeUnavailable')
      }
    } finally { if (!controller.signal.aborted) { setBusy(false); if (focus) requestAnimationFrame(() => { if (!controller.signal.aborted) heading.current?.focus() }) } }
  }, [])
  useEffect(() => {
    let mounted = true; void Promise.resolve().then(() => { if (mounted) void load() })
    const verify = () => { if (!document.hidden) void load() }
    const timer = window.setInterval(verify, 60_000); window.addEventListener('focus', verify)
    const bus = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('fgae.auth') : null
    if (bus) bus.onmessage = () => { invalidated.current = true; request.current?.abort(); setSnapshot(null); setBusy(false); setError('homeSignIn') }
    return () => { mounted = false; request.current?.abort(); clearInterval(timer); window.removeEventListener('focus', verify); bus?.close() }
  }, [load])
  useEffect(() => { if (error) heading.current?.focus() }, [error])
  async function signOut() {
    if (loggingOut.current) return
    loggingOut.current = true; request.current?.abort(); setSigningOut(true); setSnapshot(null); setBusy(false)
    try { await authService.signOut(); invalidated.current = true; setError('homeSignIn'); const bus = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('fgae.auth') : null; bus?.postMessage('signed-out'); bus?.close() }
    catch { setError('logoutFailed') } finally { loggingOut.current = false; setSigningOut(false) }
  }
  const data = snapshot?.overview
  const gate = error === 'homeSignIn' || error === 'homeDenied'
  const date = (value: string) => new Intl.DateTimeFormat(locale, { calendar: 'gregory', timeZone: 'Africa/Addis_Ababa', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  const number = (value: number) => new Intl.NumberFormat(locale).format(value)
  const metrics = data ? [
    { label: 'homeTotal', note: 'homeTotalNote', value: applicationStates.reduce((sum, state) => sum + data.counts[state], 0), icon: ClipboardTextIcon },
    { label: 'homePending', note: 'homePendingNote', value: data.counts.PENDING, icon: ClockIcon },
    { label: 'homeReturned', note: 'homeReturnedNote', value: data.counts.RETURNED, icon: ArrowUUpLeftIcon },
    { label: 'homeApproved', note: 'homeApprovedNote', value: data.counts.APPROVED, icon: CheckCircleIcon },
  ] as const : []
  return <section className="workspace-page motion-enter" aria-labelledby="overview-heading" aria-busy={busy || signingOut}>
    <div className="workspace-topline"><a className="text-link" href="/sign-in">{t('appAccount')}</a><span className="workspace-scope"><BuildingsIcon size={17} aria-hidden="true" />{t('homeScope')}</span></div>
    <div className="application-heading"><div><p className="eyebrow">{t('homeEyebrow')}</p><h1 id="overview-heading" ref={heading} tabIndex={-1}>{t(gate ? error : 'homeHeading')}</h1><p className="form-subtitle">{t(error === 'homeSignIn' ? 'homeSignInNote' : error === 'homeDenied' ? 'homeDeniedNote' : 'homeIntro')}</p></div>
      {snapshot && <div className="workspace-controls"><Button className="secondary" onClick={() => void load(true)}><ArrowClockwiseIcon size={18} aria-hidden="true" />{t('homeRefresh')}</Button><Button className="secondary" onClick={() => void signOut()}><SignOutIcon size={18} aria-hidden="true" />{t('signOut')}</Button></div>}
    </div>
    {busy || signingOut ? <p className="session-check" role="status"><span className="spinner" aria-hidden="true" />{t(signingOut ? 'signingOut' : 'homeLoading')}</p> : error ? <div className="application-state" role={gate ? 'status' : 'alert'}>{!gate && <><h2>{t('homeError')}</h2><p>{t(error)}</p></>}{gate ? <a className="primary action-link" href="/sign-in">{t(error === 'homeDenied' ? 'appAccount' : 'signIn')}</a> : <Button className="primary" onClick={() => void load(true)}>{t('appRetry')}</Button>}</div> : data && snapshot && <>
      <nav className="workspace-nav" aria-label={t('homeNav')}><a href="/workspaces/super-admin" aria-current="page"><SquaresFourIcon size={19} aria-hidden="true" />{t('homeOverview')}</a><a href="/account"><GearSixIcon size={19} aria-hidden="true" />{t('acctHeading')}</a></nav>
      <div className="workspace-banner"><div><p className="eyebrow">{snapshot.identity.name}</p><h2>{t('homeWelcome')}</h2><p>{t('homeWelcomeNote')}</p></div><BuildingsIcon className="workspace-art" size={92} weight="duotone" aria-hidden="true" /></div>
      <dl className="workspace-metrics motion-stagger">{metrics.map(metric => <div className="workspace-metric" key={metric.label}><dt><metric.icon size={23} aria-hidden="true" />{t(metric.label)}</dt><dd className="workspace-value">{number(metric.value)}</dd><dd className="workspace-metric-note">{t(metric.note)}</dd></div>)}</dl>
      <div className="workspace-columns"><section className="application-card workspace-attention" aria-labelledby="attention-heading"><h2 id="attention-heading">{t('homeAttention')}</h2><p className="step-intro">{t('homeAttentionNote')}</p>
        {data.counts.PENDING || data.counts.RETURNED ? <ul>{data.counts.PENDING > 0 && <li><span className="workspace-count">{number(data.counts.PENDING)}</span><div><h3>{t('homePending')}</h3><p>{t('homePendingAction')}</p></div></li>}{data.counts.RETURNED > 0 && <li><span className="workspace-count">{number(data.counts.RETURNED)}</span><div><h3>{t('homeReturned')}</h3><p>{t('homeReturnedAction')}</p></div></li>}</ul> : <div className="workspace-empty"><CheckCircleIcon size={28} aria-hidden="true" /><h3>{t('homeClear')}</h3><p>{t('homeClearNote')}</p></div>}
      </section><aside className="application-card workspace-account"><GearSixIcon size={25} aria-hidden="true" /><h2>{t('acctHeading')}</h2><p>{t('homeAccountNote')}</p><a className="text-link" href="/account">{t('homeOpenAccount')}<ArrowRightIcon size={18} aria-hidden="true" /></a></aside></div>
      <section className="application-card workspace-recent" aria-labelledby="recent-heading"><h2 id="recent-heading">{t('homeRecent')}</h2><p className="step-intro">{t('homeRecentNote')}</p>
        {data.recent.length ? <ul className="workspace-records">{data.recent.map(record => <li key={record.id}><div className="workspace-person"><span className="workspace-initial" aria-hidden="true">{Array.from(record.name)[0]}</span><div><h3>{record.name}</h3><p><span className="sr-only">{t('homeBranch')}: </span>{record.branch}</p></div></div><span className={`workspace-badge badge-${record.status.toLowerCase()}`}><span className="sr-only">{t('homeStatus')}: </span>{t(statusLabels[record.status])}</span><time dateTime={record.updatedAt}><span className="sr-only">{t('homeUpdated')}: </span>{date(record.updatedAt)}</time></li>)}</ul> : <div className="workspace-empty"><ClipboardTextIcon size={30} aria-hidden="true" /><h3>{t('homeEmpty')}</h3><p>{t('homeEmptyNote')}</p></div>}
        <p className="workspace-footnote">{t('homeReadOnly')}</p>
      </section><p className="workspace-checked" role="status">{t('homeChecked')}: <time dateTime={data.generatedAt}>{date(data.generatedAt)}</time></p>
    </>}
  </section>
}
