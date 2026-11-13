import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowClockwiseIcon, ArrowLeftIcon, CheckCircleIcon, ClockIcon, FileTextIcon, InfoIcon, SignOutIcon } from '@phosphor-icons/react'
import { applicationService } from '@application-adapter'
import { authService } from '@auth-adapter'
import { Button } from '../../components/Button'
import { useLocale } from '../../i18n/locale'
import type { TranslationKey } from '../../i18n/locales/en/auth'
import { ApplicationError, type ApplicationService, type ApplicationSnapshot } from '../../services/contracts/application'
import { AuthError } from '../../services/contracts/auth'

const statuses = { PENDING: 'appPending', RETURNED: 'appReturned', APPROVED: 'appApproved', REJECTED: 'appRejected' } as const
const notes = { PENDING: 'appPendingNote', RETURNED: 'appReturnedNote', APPROVED: 'appApprovedNote', REJECTED: 'appRejectedNote' } as const
const events = { PENDING: 'appEventPending', RETURNED: 'appEventReturned', APPROVED: 'appEventApproved', REJECTED: 'appEventRejected' } as const
const genders: Record<string, TranslationKey> = { FEMALE: 'regFemale', MALE: 'regMale', OTHER: 'regOther', UNDISCLOSED: 'regUndisclosed' }

export function MyApplication({ service = applicationService }: { service?: ApplicationService }) {
  const { t, locale } = useLocale()
  const [snapshot, setSnapshot] = useState<ApplicationSnapshot | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<TranslationKey | null>(null)
  const [checked, setChecked] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const request = useRef<AbortController | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const loggingOut = useRef(false)
  const invalidated = useRef(false)
  const load = useCallback(async (focus = false) => {
    if (loggingOut.current || invalidated.current) return
    request.current?.abort()
    const controller = new AbortController(); request.current = controller
    setBusy(true); setError(null); setSnapshot(null)
    try {
      const result = await service.own(controller.signal)
      if (!controller.signal.aborted) { setSnapshot(result); setChecked(new Date().toISOString()) }
    } catch (failure) {
      if (!controller.signal.aborted) {
        const code = failure instanceof ApplicationError || failure instanceof AuthError ? failure.code : 'UNAVAILABLE'
        setError(code === 'SESSION_EXPIRED' ? 'appSignIn' : code === 'FORBIDDEN' ? 'appDenied' : code === 'NETWORK' || code === 'RATE_LIMITED' || code === 'STORAGE_UNAVAILABLE' ? code : 'appUnavailable')
      }
    } finally { if (!controller.signal.aborted) { setBusy(false); if (focus) requestAnimationFrame(() => { if (!controller.signal.aborted) heading.current?.focus() }) } }
  }, [service])
  useEffect(() => {
    let mounted = true
    void Promise.resolve().then(() => { if (mounted) void load() })
    const verify = () => { if (!document.hidden) void load() }
    const timer = window.setInterval(verify, 60_000)
    window.addEventListener('focus', verify)
    const bus = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('fgae.auth') : null
    if (bus) bus.onmessage = () => { invalidated.current = true; request.current?.abort(); setSnapshot(null); setError('appSignIn'); setBusy(false) }
    return () => { mounted = false; request.current?.abort(); clearInterval(timer); window.removeEventListener('focus', verify); bus?.close() }
  }, [load])
  useEffect(() => { if (error) heading.current?.focus() }, [error])
  async function signOut() {
    if (loggingOut.current) return
    loggingOut.current = true; setSigningOut(true); request.current?.abort()
    setSnapshot(null); setBusy(false)
    try {
      await authService.signOut()
      invalidated.current = true
      const bus = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('fgae.auth') : null
      bus?.postMessage('signed-out'); bus?.close()
      setError('appSignIn')
    } catch { setError('logoutFailed') }
    finally { loggingOut.current = false; setSigningOut(false) }
  }
  const date = (value: string, birth = false) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', ...(birth ? {} : { timeStyle: 'short' as const }), calendar: 'gregory', timeZone: birth ? 'UTC' : 'Africa/Addis_Ababa' }).format(new Date(value))
  const record = snapshot?.application
  const gate = error === 'appSignIn' || error === 'appDenied'
  return <section className="application-page motion-enter" aria-labelledby="application-heading" aria-busy={busy || signingOut}>
    <a className="back-link text-link" href="/sign-in"><ArrowLeftIcon size={17} aria-hidden="true" />{t('appAccount')}</a>
    <div className="application-heading"><div><p className="eyebrow">{t('appEyebrow')}</p><h1 id="application-heading" ref={heading} tabIndex={-1}>{t(gate ? error : 'appHeading')}</h1><p className="form-subtitle">{t(error === 'appSignIn' ? 'appSignInNote' : error === 'appDenied' ? 'appDeniedNote' : 'appIntro')}</p></div>
      {snapshot && <Button className="secondary application-signout" disabled={signingOut} onClick={() => void signOut()}><SignOutIcon size={18} aria-hidden="true" />{t('signOut')}</Button>}
    </div>
    {busy || signingOut ? <p className="session-check" role="status"><span className="spinner" aria-hidden="true" />{t(signingOut ? 'signingOut' : 'appRefreshing')}</p> : error ? <div className="application-state motion-enter" role={gate ? 'status' : 'alert'}>
      {!gate && <><h2>{t(error === 'logoutFailed' ? 'logoutFailed' : 'appError')}</h2><p>{t(error)}</p></>}
      {gate ? <a href="/sign-in" className="primary action-link">{t(error === 'appSignIn' ? 'signIn' : 'appAccount')}</a> : <Button className="primary" disabled={signingOut} onClick={() => void load(true)}>{t('appRetry')}</Button>}
    </div> : snapshot && <div className="motion-enter">
      <div className="application-owner"><span>{snapshot.identity.name}</span><span>{snapshot.identity.email}</span></div>
      {record ? <>
        <div className={`application-status status-${record.status.toLowerCase()}`}>
          <div className="application-status-icon" aria-hidden="true">{record.status === 'APPROVED' ? <CheckCircleIcon size={30} /> : <ClockIcon size={30} />}</div>
          <div><p className="eyebrow">{t('appHeading')}</p><h2>{t(statuses[record.status])}</h2><p>{t(notes[record.status])}</p></div>
        </div>
        <dl className="application-meta"><div><dt>{t('appReference')}</dt><dd>{record.id}</dd></div><div><dt>{t('appSubmitted')}</dt><dd><time dateTime={record.submittedAt}>{date(record.submittedAt)}</time></dd></div><div><dt>{t('appUpdated')}</dt><dd><time dateTime={record.updatedAt}>{date(record.updatedAt)}</time></dd></div></dl>
        <div className="application-columns">
          <div className="application-information">
            <details className="application-card" open><summary>{t('appDetails')}</summary><dl className="application-details">
              {([['regFullName', record.fields.fullName], ['email', record.fields.email], ['regPhone', record.fields.phone], ['regBirthDate', record.fields.birthDate ? date(record.fields.birthDate + 'T00:00:00Z', true) : ''], ['regGender', record.fields.gender ? t(genders[record.fields.gender]!) : ''], ['regBranch', record.branchName]] as [TranslationKey, string][]).map(([key, value]) => <div key={key}><dt>{t(key)}</dt><dd>{value || t('appNoValue')}</dd></div>)}
            </dl></details>
            <details className="application-card" open><summary>{t('appDocuments')}<span className="application-count">{new Intl.NumberFormat(locale).format(record.documents.length)}</span></summary>
              <p className="application-muted">{t(record.documents.length ? 'appDocumentNote' : 'appNoDocuments')}</p>
              <ul className="application-files">{record.documents.map(doc => <li key={doc.id}><FileTextIcon size={24} aria-hidden="true" /><div><strong>{doc.name}</strong><p>{doc.mime === 'application/pdf' ? 'PDF' : doc.mime === 'image/png' ? 'PNG' : 'JPEG'} · <span aria-label={t('appFileSize')}>{new Intl.NumberFormat(locale, { style: 'unit', unit: 'kilobyte', maximumFractionDigits: 1 }).format(doc.size / 1024)}</span></p></div></li>)}</ul>
            </details>
          </div>
          <section className="application-card application-history" aria-labelledby="history-heading"><h2 id="history-heading">{t('appHistory')}</h2><ol>{[...record.history].reverse().map((event, index) => <li key={event.id} className={index === 0 ? 'latest' : ''}><span className="timeline-dot" aria-hidden="true" /><h3>{t(events[event.status])}</h3><time dateTime={event.at}>{date(event.at)}</time>{event.note && <p className="decision-note">{event.note}</p>}</li>)}</ol></section>
        </div>
      </> : <div className="application-state"><FileTextIcon size={32} aria-hidden="true" /><h2>{t('appEmpty')}</h2><p>{t('appEmptyNote')}</p></div>}
      <div className="application-refresh"><Button className="secondary" onClick={() => void load(true)}><ArrowClockwiseIcon size={18} aria-hidden="true" />{t('appRefresh')}</Button>{checked && <p>{t('appChecked')}: <time dateTime={checked}>{date(checked)}</time></p>}</div>
      <p className="application-muted">{t('appTimeNote')}</p>
      <aside className="account-help"><InfoIcon size={21} aria-hidden="true" /><div><h2>{t('appHelp')}</h2><p>{t('appHelpNote')}</p></div></aside>
    </div>}
  </section>
}
