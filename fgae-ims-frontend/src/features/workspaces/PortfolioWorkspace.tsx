import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowClockwiseIcon, BuildingsIcon, CheckCircleIcon, GearSixIcon, SignOutIcon, ClipboardTextIcon } from '@phosphor-icons/react'
import { portfolioService } from '@portfolio-adapter'
import { authService } from '@auth-adapter'
import { Button } from '../../components/Button'
import { useLocale } from '../../i18n/locale'
import type { TranslationKey } from '../../i18n/locales/en/auth'
import { roles } from '../../services/contracts/auth'
import { filterDirectory, portfolioPath, type PortfolioKind, type PortfolioSnapshot } from '../../services/contracts/portfolio'
const pageCopy = {
  'project-manager': { title: 'projectHeading', intro: 'projectIntro', welcome: 'projectWelcome' },
  member: { title: 'memberHeading', intro: 'memberIntro', welcome: 'memberWelcome' },
  users: { title: 'usersHeading', intro: 'usersIntro', welcome: 'usersWelcome' },
} as const
const workStates = { PLANNED: 'mgrPlanned', ACTIVE: 'mgrActive', COMPLETED: 'mgrCompleted', CANCELLED: 'opsCancelled' } as const
const allowanceStates = { DRAFT: 'opsDraft', SUBMITTED: 'opsSubmitted', VERIFIED: 'opsVerifiedRequest', APPROVED: 'opsApproved', PROCESSING: 'opsProcessing', PAID: 'opsPaidState', FAILED: 'opsFailed', RETURNED: 'opsReturned', CANCELLED: 'opsCancelled' } as const
const decisions = { PENDING: 'appPending', RETURNED: 'appReturned', APPROVED: 'appApproved', REJECTED: 'appRejected' } as const
const memberStates = { NOT_A_MEMBER: 'portNotMember', APPLIED: 'portApplied', ACTIVE_MEMBER: 'portActiveMember' } as const
const paymentStates = { PENDING: 'opsPaymentPending', SUCCESSFUL: 'opsSuccessful', FAILED: 'opsFailed', CANCELLED: 'opsCancelled' } as const
const userStates = { ACTIVE: 'accessActive', PENDING: 'accessPending', SUSPENDED: 'accessSuspended', INACTIVE: 'accessInactive' } as const
const scopeLabels = { global: 'scopeGlobal', area: 'scopeArea', branch: 'scopeBranch', project: 'scopeProject', supervision: 'scopeSupervision', self: 'scopeSelf' } as const
export function PortfolioWorkspace({ kind }: { kind: PortfolioKind }) {
  const { t, locale } = useLocale()
  const copy = pageCopy[kind]
  const [query, setQuery] = useState(''); const [status, setStatus] = useState(''); const [role, setRole] = useState(''); const [page, setPage] = useState(1)
  const results = useRef<HTMLHeadingElement>(null)
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null)
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
    try { const result = await portfolioService.load(kind, controller.signal); if (!controller.signal.aborted) setSnapshot(result) }
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
  const work = data?.projects.flatMap(project => project.work) ?? []
  const metrics: { label: TranslationKey; value: number; monetary?: boolean }[] = !data ? [] : kind === 'project-manager' ? [
    { label: 'portProjects', value: data.projects.length }, { label: 'portActivities', value: work.filter(row => row.state === 'ACTIVE').length }, { label: 'portVolunteers', value: new Set(work.flatMap(row => row.volunteerIds)).size }, { label: 'portAvailable', value: data.projects.reduce((sum, row) => sum + row.availableMinor, 0), monetary: true },
  ] : kind === 'member' ? [
    { label: 'portMemberships', value: data.memberships.length }, { label: 'portActiveMembers', value: data.memberships.filter(row => row.status === 'ACTIVE_MEMBER').length }, { label: 'portReviewPending', value: data.memberships.filter(row => row.review === 'PENDING').length }, { label: 'portConfirmed', value: data.memberships.flatMap(row => row.payments).filter(row => row.state === 'SUCCESSFUL').reduce((sum, row) => sum + row.amountMinor, 0), monetary: true },
  ] : [{ label: 'portUsers', value: data.users.length }, { label: 'portActiveUsers', value: data.users.filter(row => row.state === 'ACTIVE').length }, { label: 'portPendingUsers', value: data.users.filter(row => row.state === 'PENDING').length }, { label: 'portRestrictedUsers', value: data.users.filter(row => row.state === 'SUSPENDED' || row.state === 'INACTIVE').length }]
  const filtered = filterDirectory(data?.users ?? [], query, status, role)
  const pages = Math.max(1, Math.ceil(filtered.length / 8)); const currentPage = Math.min(page, pages)
  function movePage(next: number) { setPage(next); requestAnimationFrame(() => results.current?.focus()) }
  function clearFilters() { setQuery(''); setStatus(''); setRole(''); setPage(1); requestAnimationFrame(() => document.getElementById('directory-search')?.focus()) }
  return <section className="workspace-page participant-page portfolio-page motion-enter" aria-labelledby="portfolio-heading" aria-busy={busy || signingOut}>
    <div className="workspace-topline"><a href="/sign-in" className="text-link">{t('appAccount')}</a><span className="workspace-scope"><BuildingsIcon size={17} aria-hidden="true" />{t('opsScope')}</span></div>
    <div className="application-heading"><div><p className="eyebrow">{t(copy.title)}</p><h1 id="portfolio-heading" ref={heading} tabIndex={-1}>{t(gate ? error : copy.title)}</h1><p className="form-subtitle">{t(error === 'mgrSignIn' ? 'homeSignInNote' : error === 'mgrDenied' ? 'mgrDeniedNote' : copy.intro)}</p></div>{snapshot && <div className="workspace-controls"><Button className="secondary" onClick={() => void load(true)}><ArrowClockwiseIcon size={18} aria-hidden="true" />{t('homeRefresh')}</Button><Button className="secondary" onClick={() => void signOut()}><SignOutIcon size={18} aria-hidden="true" />{t('signOut')}</Button></div>}</div>
    {busy || signingOut ? <p className="session-check" role="status"><span className="spinner" aria-hidden="true" />{t(signingOut ? 'signingOut' : 'mgrLoading')}</p> : error ? <div className="application-state" role={gate ? 'status' : 'alert'}>{!gate && <><h2>{t('homeError')}</h2><p>{t(error)}</p></>}{gate ? <a href="/sign-in" className="primary action-link">{t(error === 'mgrDenied' ? 'appAccount' : 'signIn')}</a> : <Button className="primary" onClick={() => void load(true)}>{t('appRetry')}</Button>}</div> : data && snapshot && <>
      <nav className="workspace-nav" aria-label={t('homeNav')}><a href={portfolioPath(kind)} aria-current="page">{t('homeOverview')}</a><a href="/account"><GearSixIcon size={18} aria-hidden="true" />{t('acctHeading')}</a>{kind === 'users' && <a href="/workspaces/super-admin">{t('homeLink')}</a>}</nav>
      <div className="workspace-banner"><div><p className="eyebrow">{snapshot.identity.name}</p><h2>{t(copy.welcome)}</h2><p>{t('mgrWelcomeNote')}</p></div><CheckCircleIcon size={80} className="workspace-art" aria-hidden="true" /></div>
      <dl className="workspace-metrics motion-stagger">{metrics.map(item => <div className="workspace-metric" key={item.label}><dt><ClipboardTextIcon size={22} aria-hidden="true" />{t(item.label)}</dt><dd className="workspace-value">{item.monetary ? money(item.value) : number(item.value)}</dd><dd className="workspace-metric-note">{t(item.label === 'portAvailable' ? 'portProjectNote' : item.monetary ? 'opsMoneyNote' : 'opsCountNote')}</dd></div>)}</dl>
      {kind === 'project-manager' && <section aria-labelledby="project-list"><h2 id="project-list">{t('portProjectList')}</h2>{data.projects.length ? data.projects.map(project => <article className="application-card manager-section portfolio-project" key={project.id}><div className="manager-work-heading"><h3>{project.name}</h3><span className="workspace-badge">{t(workStates[project.state])}</span></div><dl className="portfolio-facts"><div><dt>{t('opsStart')}</dt><dd>{date(project.startAt)}</dd></div><div><dt>{t('opsEnd')}</dt><dd>{date(project.endAt)}</dd></div><div><dt>{t('opsAvailable')}</dt><dd>{money(project.availableMinor)}</dd></div><div><dt>{t('portReturned')}</dt><dd>{number(project.allowances.filter(row => row.state === 'RETURNED').length)}</dd></div></dl>
        <h4>{t('portWork')}</h4><p className="step-intro">{t('portWorkNote')}</p>{project.work.length ? <ul className="manager-work portfolio-work">{[...project.work].sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt)).slice(0, 6).map(row => <li key={row.id}><div className="manager-work-heading"><h5>{row.title}</h5><span className="workspace-badge">{t(workStates[row.state])}</span></div><dl><div><dt>{t('mgrDue')}</dt><dd>{date(row.dueAt)}</dd></div><div><dt>{t('portAssigned')}</dt><dd>{number(row.volunteerIds.length)}</dd></div><div><dt>{t('portSubmitted')}</dt><dd>{number(row.attendance.length)}</dd></div><div><dt>{t('portVerified')}</dt><dd>{number(row.attendance.filter(item => item.verification === 'VERIFIED').length)}</dd></div></dl></li>)}</ul> : <p>{t('portNoWork')}</p>}
        <h4 className="manager-section">{t('portRequests')}</h4><p className="step-intro">{t('portAllowanceNote')}</p>{project.allowances.length ? <ul className="workspace-records portfolio-allowances">{[...project.allowances].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 6).map(row => <li key={row.id}><strong>{money(row.amountMinor)}</strong><span className="workspace-badge">{t(allowanceStates[row.state])}</span><time dateTime={row.updatedAt}>{date(row.updatedAt)}</time></li>)}</ul> : <p>{t('portNoAllowances')}</p>}</article>) : <p className="application-card">{t('portNoProjects')}</p>}<p className="workspace-footnote">{t('portReadOnly')}</p></section>}
      {kind === 'member' && <section aria-labelledby="membership-list"><h2 id="membership-list">{t('portMembershipList')}</h2><p className="step-intro">{t('portMemberNote')}</p>{data.memberships.length ? data.memberships.map(member => <article className="application-card manager-section portfolio-membership" key={member.id}><h3>{member.name}</h3><dl className="portfolio-facts"><div><dt>{t('portMembershipState')}</dt><dd>{t(memberStates[member.status])}</dd></div><div><dt>{t('portReviewState')}</dt><dd>{member.review ? t(decisions[member.review]) : t('portNoDecision')}</dd></div><div><dt>{t('portCategory')}</dt><dd>{member.category ?? t('portUnconfigured')}</dd></div><div><dt>{t('portDues')}</dt><dd>{member.duesMinor === null ? t('portUnconfigured') : money(member.duesMinor)}</dd></div><div><dt>{t('portExpiry')}</dt><dd>{member.expiresAt ? date(member.expiresAt) : t('portNoExpiry')}</dd></div><div><dt>{t('portRenewal')}</dt><dd>{t(member.renewalEligible ? 'portRenewalYes' : 'portRenewalNo')}</dd></div></dl>
        <h4>{t('portHistory')}</h4>{member.history.length ? <ul className="workspace-records portfolio-history">{[...member.history].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).map(row => <li key={row.id}><div><strong>{t(decisions[row.status])}</strong>{row.note && <p>{row.note}</p>}</div><time dateTime={row.at}>{date(row.at)}</time></li>)}</ul> : <p>{t('portNoHistory')}</p>}
        <h4 className="manager-section">{t('opsPayments')}</h4>{member.payments.length ? <ul className="workspace-records portfolio-payments">{[...member.payments].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).map(row => <li key={row.id}><strong>{money(row.amountMinor)}</strong><span className="workspace-badge">{t(paymentStates[row.state])}</span><time dateTime={row.at}>{date(row.at)}</time></li>)}</ul> : <p>{t('opsNoPayments')}</p>}<p className="workspace-footnote">{t('opsPendingMoney')}</p></article>) : <p className="application-card">{t('portNoMemberships')}</p>}</section>}
      {kind === 'users' && <section className="application-card" aria-labelledby="directory-heading"><h2 id="directory-heading" tabIndex={-1} ref={results}>{t('portDirectory')}</h2><p className="step-intro">{t('portDirectoryNote')}</p><div className="directory-filters"><div className="field"><label htmlFor="directory-search">{t('portSearch')}</label><input id="directory-search" type="search" maxLength={150} value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} /></div><div className="field"><label htmlFor="directory-state">{t('portState')}</label><select id="directory-state" value={status} onChange={event => { setStatus(event.target.value); setPage(1) }}><option value="">{t('portAllStates')}</option>{Object.entries(userStates).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select></div><div className="field"><label htmlFor="directory-role">{t('portRole')}</label><select id="directory-role" value={role} onChange={event => { setRole(event.target.value); setPage(1) }}><option value="">{t('portAllRoles')}</option>{roles.map(value => <option key={value} value={value}>{t(value)}</option>)}</select></div><Button className="secondary" onClick={clearFilters}>{t('portClear')}</Button></div><p className="directory-count" role="status">{t('portResults')}: {number(filtered.length)}</p>
        {filtered.length ? <ul className="directory-users">{filtered.slice((currentPage - 1) * 8, currentPage * 8).map(user => <li key={user.id}><div className="manager-work-heading"><h3>{user.name}</h3><span className="workspace-badge">{t(userStates[user.state])}</span></div><p className="directory-email">{user.email}</p>{user.mustChangePassword && <p className="manager-followup">{t('portPasswordSetup')}</p>}{user.grants.length ? <ul className="directory-grants">{user.grants.map(grant => <li key={JSON.stringify([grant.role, grant.scope.kind, grant.scope.id])}><strong>{t(grant.role)}</strong><span>{t(scopeLabels[grant.scope.kind])}{grant.scope.kind !== 'global' ? ` · ${grant.scopeName}` : ''}</span></li>)}</ul> : <p>{t('portNoGrants')}</p>}</li>)}</ul> : <p className="workspace-empty">{t(data.users.length ? 'portNoResults' : 'portNoUsers')}</p>}
        {filtered.length > 8 && <nav className="directory-pages" aria-label={t('portPage')}><Button className="secondary" disabled={currentPage === 1} onClick={() => movePage(currentPage - 1)}>{t('portPrevious')}</Button><span>{t('portPage')} {number(currentPage)} {t('portOf')} {number(pages)}</span><Button className="secondary" disabled={currentPage === pages} onClick={() => movePage(currentPage + 1)}>{t('portNext')}</Button></nav>}<p className="workspace-footnote">{t('portUserReadOnly')}</p></section>}
      <p className="workspace-checked" role="status">{t('homeChecked')}: <time dateTime={data.generatedAt}>{date(data.generatedAt)}</time></p>
    </>}
  </section>
}
