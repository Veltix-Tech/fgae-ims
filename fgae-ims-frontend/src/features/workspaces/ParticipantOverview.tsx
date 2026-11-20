import { financeEligible, isGlobalAdmin } from '../../services/contracts/participant-overview'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowClockwiseIcon, BuildingsIcon, CheckCircleIcon, GearSixIcon, SignOutIcon, ClipboardTextIcon } from '@phosphor-icons/react'
import { participantOverviewService } from '@participant-overview-adapter'
import { authService } from '@auth-adapter'
import { Button } from '../../components/Button'
import { useLocale } from '../../i18n/locale'
import type { TranslationKey } from '../../i18n/locales/en/auth'
import type { ParticipantKind, ParticipantSnapshot } from '../../services/contracts/participant-overview'
const pageCopy = {
  'field-supervisor': { title: 'supervisorHeading', intro: 'supervisorIntro', welcome: 'supervisorWelcome' },
  'finance-officer': { title: 'financeHeading', intro: 'financeIntro', welcome: 'financeWelcome' },
  volunteer: { title: 'volunteerHeading', intro: 'volunteerIntro', welcome: 'volunteerWelcome' },
} as const
const allowanceStates = { DRAFT: 'opsDraft', SUBMITTED: 'opsSubmitted', VERIFIED: 'opsVerifiedRequest', APPROVED: 'opsApproved', PROCESSING: 'opsProcessing', PAID: 'opsPaidState', FAILED: 'opsFailed', RETURNED: 'opsReturned', CANCELLED: 'opsCancelled' } as const
const attendanceStates = { PRESENT: 'opsPresent', ABSENT: 'opsAbsent', LATE: 'opsLate', EXCUSED: 'opsExcused' } as const
const verificationStates = { PENDING: 'opsPending', VERIFIED: 'opsVerified', REJECTED: 'appRejected' } as const
const paymentStates = { PENDING: 'opsPaymentPending', SUCCESSFUL: 'opsSuccessful', FAILED: 'opsFailed', CANCELLED: 'opsCancelled' } as const
export function ParticipantOverview({ kind }: { kind: ParticipantKind }) {
  const { t, locale } = useLocale()
  const copy = pageCopy[kind]
  const [snapshot, setSnapshot] = useState<ParticipantSnapshot | null>(null)
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
    try { const result = await participantOverviewService.load(kind, controller.signal); if (!controller.signal.aborted) setSnapshot(result) }
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
  const money = (value: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'ETB' }).format(value / 100)
  const latest = <T extends { updatedAt: string }>(rows: T[]) => [...rows].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 6)
  const active = data?.assignments.filter(row => row.state === 'ACTIVE') ?? []
  const pending = data?.attendance.filter(row => row.verification === 'PENDING').length ?? 0
  const rejected = data?.attendance.filter(row => row.verification === 'REJECTED').length ?? 0
  const evidence = data?.allowances.filter(row => row.state === 'SUBMITTED').length ?? 0
  const approvals = data && snapshot ? data.allowances.filter(row => financeEligible(snapshot.identity, data, row, 'approve')).length : 0
  const payouts = data && snapshot ? data.allowances.filter(row => financeEligible(snapshot.identity, data, row, 'disburse')).length : 0
  const exceptions = data ? data.allowances.filter(row => row.state === 'FAILED').length + data.payments.filter(row => row.state === 'FAILED').length : 0
  const paid = data?.allowances.filter(row => row.state === 'PAID').reduce((sum, row) => sum + (row.amountMinor ?? 0), 0) ?? 0
  const collected = data?.payments.filter(row => row.state === 'SUCCESSFUL').reduce((sum, row) => sum + row.amountMinor, 0) ?? 0
  const metrics: { label: TranslationKey; value: number; monetary?: boolean }[] = kind === 'finance-officer' ? [
    { label: 'opsApproval', value: approvals }, { label: 'opsPayout', value: payouts }, { label: 'opsExceptions', value: exceptions }, { label: 'opsCollections', value: collected, monetary: true },
  ] : kind === 'field-supervisor' ? [
    { label: 'opsActive', value: active.length }, { label: 'opsReview', value: pending }, { label: 'opsEvidence', value: evidence }, { label: 'opsPeople', value: new Set(data?.assignments.map(row => row.volunteerId)).size },
  ] : [{ label: 'opsActive', value: active.length }, { label: 'opsPending', value: pending }, { label: 'opsRejected', value: rejected }, { label: 'opsPaid', value: paid, monetary: true }]
  const priorities = metrics.filter(row => !row.monetary && row.value && (kind === 'finance-officer' || row.label === 'opsReview' || row.label === 'opsEvidence' || row.label === 'opsRejected'))
  const ordered = [...(data?.assignments ?? [])].sort((a, b) => Number(b.state === 'ACTIVE') - Number(a.state === 'ACTIVE') || Date.parse(a.startAt) - Date.parse(b.startAt))
  const next = active.filter(row => Date.parse(row.endAt) >= Date.parse(data!.generatedAt)).sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))[0]
  const localDay = (value: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Addis_Ababa', calendar: 'gregory', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
  const today = data ? active.filter(row => localDay(row.startAt) <= localDay(data.generatedAt) && localDay(row.endAt) >= localDay(data.generatedAt)).length : 0
  return <section className="workspace-page participant-page motion-enter" aria-labelledby="participant-heading" aria-busy={busy || signingOut}>
    <div className="workspace-topline"><a href="/sign-in" className="text-link">{t('appAccount')}</a><span className="workspace-scope"><BuildingsIcon size={17} aria-hidden="true" />{t('opsScope')}</span></div>
    <div className="application-heading"><div><p className="eyebrow">{t(copy.title)}</p><h1 id="participant-heading" ref={heading} tabIndex={-1}>{t(gate ? error : copy.title)}</h1><p className="form-subtitle">{t(error === 'mgrSignIn' ? 'homeSignInNote' : error === 'mgrDenied' ? 'mgrDeniedNote' : copy.intro)}</p></div>{snapshot && <div className="workspace-controls"><Button className="secondary" onClick={() => void load(true)}><ArrowClockwiseIcon size={18} aria-hidden="true" />{t('homeRefresh')}</Button><Button className="secondary" onClick={() => void signOut()}><SignOutIcon size={18} aria-hidden="true" />{t('signOut')}</Button></div>}</div>
    {busy || signingOut ? <p className="session-check" role="status"><span className="spinner" aria-hidden="true" />{t(signingOut ? 'signingOut' : 'mgrLoading')}</p> : error ? <div className="application-state" role={gate ? 'status' : 'alert'}>{!gate && <><h2>{t('homeError')}</h2><p>{t(error)}</p></>}{gate ? <a href="/sign-in" className="primary action-link">{t(error === 'mgrDenied' ? 'appAccount' : 'signIn')}</a> : <Button className="primary" onClick={() => void load(true)}>{t('appRetry')}</Button>}</div> : data && snapshot && <>
      <nav className="workspace-nav" aria-label={t('homeNav')}><a href={`/workspaces/${kind}`} aria-current="page">{t('homeOverview')}</a><a href="/account"><GearSixIcon size={18} aria-hidden="true" />{t('acctHeading')}</a>{kind === 'volunteer' && snapshot.identity.grants.some(grant => grant.role === 'VOLUNTEER' && grant.scope.kind === 'self' && grant.scope.id === snapshot.identity.id) && <a href="/my-application">{t('opsOwnApplication')}</a>}</nav>
      <div className="workspace-banner"><div><p className="eyebrow">{snapshot.identity.name}</p><h2>{t(copy.welcome)}</h2><p>{t('mgrWelcomeNote')}</p></div><CheckCircleIcon className="workspace-art" size={80} aria-hidden="true" /></div>
      <dl className="workspace-metrics motion-stagger">{metrics.map(item => <div className="workspace-metric" key={item.label}><dt><ClipboardTextIcon size={22} aria-hidden="true" />{t(item.label)}</dt><dd className="workspace-value">{item.monetary ? money(item.value) : number(item.value)}</dd><dd className="workspace-metric-note">{t(item.monetary ? 'opsMoneyNote' : 'opsCountNote')}</dd></div>)}</dl>
      <div className="workspace-columns"><section className="application-card workspace-attention"><h2>{t('opsPriorities')}</h2>{priorities.length ? <ul className="participant-followups">{priorities.map(row => <li key={row.label}><span className="workspace-count">{number(row.value)}</span><div><h3>{t(row.label)}</h3></div></li>)}</ul> : <p>{t('opsNoPriorities')}</p>}{kind !== 'finance-officer' && <div className="participant-next"><p>{t('opsToday')}: <strong>{number(today)}</strong></p><h3>{t('opsNext')}</h3>{next ? <><p>{next.title}</p><time dateTime={next.startAt}>{date(next.startAt)}</time></> : <p>{t('opsNoNext')}</p>}</div>}</section><section className="application-card workspace-account"><GearSixIcon size={24} aria-hidden="true" /><h2>{t('acctHeading')}</h2><p>{t('homeAccountNote')}</p><a className="text-link" href="/account">{t('homeOpenAccount')}</a></section></div>
      {kind === 'finance-officer' && <section className="application-card manager-section"><h2>{t('opsCapabilities')}</h2><ul className="manager-locations">{data.capabilities.approve && <li>{t('opsCanApprove')}</li>}{data.capabilities.disburse && <li>{t('opsCanDisburse')}</li>}{!data.capabilities.approve && !data.capabilities.disburse && <li>{t('opsReadOnly')}</li>}</ul><p>{t(isGlobalAdmin(snapshot.identity) ? 'opsAdmin' : 'opsSeparation')}</p></section>}
      {kind !== 'finance-officer' && <>
        <section className="application-card manager-section"><h2>{t('opsAssignmentSection')}</h2><p className="step-intro">{t('opsAssignmentNote')}</p>{ordered.length ? <ul className="manager-work participant-assignments">{ordered.slice(0, 6).map(row => <li key={row.id}><div className="manager-work-heading"><div><h3>{row.title}</h3><p>{row.place}{kind === 'field-supervisor' ? ` · ${row.volunteerName}` : ''}</p></div><span className="workspace-badge">{t(row.state === 'ACTIVE' ? 'mgrActive' : row.state === 'ENDED' ? 'opsEnded' : 'opsCancelled')}</span></div><dl><div><dt>{t('opsStart')}</dt><dd><time dateTime={row.startAt}>{date(row.startAt)}</time></dd></div><div><dt>{t('opsEnd')}</dt><dd><time dateTime={row.endAt}>{date(row.endAt)}</time></dd></div></dl>{!row.supervisorId && <p className="manager-followup">{t('opsMissingSupervisor')}</p>}</li>)}</ul> : <p>{t('opsNoAssignments')}</p>}</section>
        <section className="application-card manager-section"><h2>{t('opsAttendanceSection')}</h2><p className="step-intro">{t('opsAttendanceNote')}</p>{data.attendance.length ? <ul className="manager-work participant-attendance">{[...data.attendance].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).map(row => <li key={row.id}><h3>{data.assignments.find(item => item.id === row.assignmentId)?.title}</h3><time dateTime={row.date}>{new Intl.DateTimeFormat(locale, { calendar: 'gregory', timeZone: 'Africa/Addis_Ababa', dateStyle: 'medium' }).format(new Date(`${row.date}T12:00:00Z`))}</time><dl><div><dt>{t('opsAttendanceState')}</dt><dd>{t(attendanceStates[row.attendance])}</dd></div><div><dt>{t('opsVerification')}</dt><dd>{t(verificationStates[row.verification])}</dd></div></dl><p>{t(row.evidence ? 'opsEvidenceAvailable' : 'opsNoEvidence')}</p></li>)}</ul> : <p>{t('opsNoAttendance')}</p>}</section>
      </>}
      <section className="application-card manager-section"><h2>{t('opsAllowanceSection')}</h2><p className="step-intro">{t('opsAllowanceNote')}</p>{data.allowances.length ? <ul className="workspace-records participant-allowances">{latest(data.allowances).map(row => <li key={row.id}><div><h3>{row.title}</h3>{row.amountMinor !== null && <p>{money(row.amountMinor)}</p>}</div><span className={`workspace-badge ${row.state === 'PAID' ? 'badge-approved' : row.state === 'FAILED' ? 'badge-rejected' : ''}`}>{t(allowanceStates[row.state])}</span><time dateTime={row.updatedAt}>{date(row.updatedAt)}</time></li>)}</ul> : <p>{t('opsNoAllowances')}</p>}</section>
      {kind !== 'field-supervisor' && <section className="application-card manager-section"><h2>{t('opsPayments')}</h2><p className="step-intro">{t('opsPaymentsNote')}</p>{data.payments.length ? <ul className="workspace-records participant-payments">{latest(data.payments).map(row => <li key={row.id}><div><h3>{row.title}</h3><p>{money(row.amountMinor)}</p></div><span className={`workspace-badge ${row.state === 'SUCCESSFUL' ? 'badge-approved' : row.state === 'FAILED' ? 'badge-rejected' : ''}`}>{t(paymentStates[row.state])}</span><time dateTime={row.updatedAt}>{date(row.updatedAt)}</time></li>)}</ul> : <p>{t('opsNoPayments')}</p>}<p className="workspace-footnote">{t('opsPendingMoney')}</p></section>}
      {kind === 'finance-officer' && <section className="application-card manager-section"><h2>{t('opsBudgets')}</h2><p className="step-intro">{t('opsBudgetNote')}</p>{data.budgets.length ? <ul className="manager-work participant-budgets">{data.budgets.map(row => <li key={row.id}><h3>{row.title}</h3><p>{t('opsAvailable')}: {money(row.availableMinor)}</p></li>)}</ul> : <p>{t('opsNoBudgets')}</p>}</section>}
      <p className="workspace-footnote">{t('opsSummaryOnly')}</p><p className="workspace-checked" role="status">{t('homeChecked')}: <time dateTime={data.generatedAt}>{date(data.generatedAt)}</time></p>
    </>}
  </section>
}
