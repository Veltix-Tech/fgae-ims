import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { ArrowLeftIcon, ArrowRightIcon, CheckCircleIcon, EyeIcon, EyeSlashIcon, InfoIcon, LockKeyIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { resetPasswordService } from '@reset-adapter'
import { Button } from '../../components/Button'
import { useLocale } from '../../i18n/locale'
import type { TranslationKey } from '../../i18n/locales/en/auth'
import { ResetError, validNewPassword, type ResetErrorCode, type ResetPasswordService } from '../../services/contracts/reset-password'

type View = 'checking' | 'ready' | 'missing' | 'invalid' | 'expired' | 'used' | 'check-error' | 'success'
const terminal = (code: ResetErrorCode): View | null => ({ INVALID_LINK: 'invalid', EXPIRED_LINK: 'expired', USED_LINK: 'used' } as Partial<Record<ResetErrorCode, View>>)[code] ?? null
const headings: Record<View, TranslationKey> = { checking: 'resetCheckHeading', ready: 'resetHeading', missing: 'resetMissingHeading', invalid: 'resetInvalidHeading', expired: 'resetExpiredHeading', used: 'resetUsedHeading', 'check-error': 'resetCheckFailedHeading', success: 'resetSuccessHeading' }
const descriptions: Record<View, TranslationKey> = { checking: 'resetCheckIntro', ready: 'resetIntro', missing: 'resetMissing', invalid: 'resetInvalid', expired: 'resetExpired', used: 'resetUsed', 'check-error': 'resetUnavailable', success: 'resetSuccess' }
function errorKey(code: ResetErrorCode): TranslationKey {
  if (code === 'NETWORK' || code === 'RATE_LIMITED') return code
  return ({ SAME_PASSWORD: 'resetSame', PASSWORD_REJECTED: 'resetRejected', CONFIRMATION_MISMATCH: 'resetMismatch', STORAGE_UNAVAILABLE: 'resetStorage' } as Partial<Record<ResetErrorCode, TranslationKey>>)[code] ?? 'resetUnavailable'
}

export function ResetPassword({ token: initialToken, service = resetPasswordService }: { token: string; service?: ResetPasswordService }) {
  const { t } = useLocale()
  const token = useRef(initialToken)
  const [view, setView] = useState<View>(initialToken ? 'checking' : 'missing')
  const [checkAttempt, setCheckAttempt] = useState(0)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [show, setShow] = useState({ password: false, confirmation: false })
  const [fields, setFields] = useState<{ password?: TranslationKey; confirmation?: TranslationKey }>({})
  const [error, setError] = useState<TranslationKey | null>(null)
  const [busy, setBusy] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const feedback = useRef<HTMLDivElement>(null)
  const leaveHeading = useRef<HTMLHeadingElement>(null)
  const passwordInput = useRef<HTMLInputElement>(null)
  const confirmationInput = useRef<HTMLInputElement>(null)
  const backLink = useRef<HTMLAnchorElement>(null)
  const active = useRef<AbortController | null>(null)
  const inFlight = useRef(false)
  const intent = useRef<{ password: string; key: string } | null>(null)
  const dirty = view === 'ready' && !!(password || confirmation)

  useEffect(() => {
    const openLink = () => {
      const tokens = new URLSearchParams(window.location.hash.slice(1)).getAll('token')
      if (!tokens.length) return
      history.replaceState(null, '', '/reset-password')
      if (dirty && !window.confirm(t('resetLeave'))) return
      active.current?.abort()
      token.current = tokens.length === 1 && tokens[0]!.length <= 2048 ? tokens[0]! : ''
      setPassword(''); setConfirmation(''); setFields({}); setError(null); setLeaving(false)
      setShow({ password: false, confirmation: false }); intent.current = null
      inFlight.current = false; setBusy(false)
      setView(token.current ? 'checking' : 'missing'); setCheckAttempt(old => old + 1)
    }
    window.addEventListener('hashchange', openLink)
    return () => window.removeEventListener('hashchange', openLink)
  }, [dirty, t])

  useEffect(() => {
    if (!token.current) return
    const controller = new AbortController()
    active.current = controller
    service.validate(token.current, controller.signal).then(() => {
      if (!controller.signal.aborted) setView('ready')
    }).catch(failure => {
      if (!controller.signal.aborted) {
        const code = failure instanceof ResetError ? failure.code : 'UNAVAILABLE'
        setView(terminal(code) ?? 'check-error'); setError(terminal(code) ? null : errorKey(code))
      }
    })
    return () => { controller.abort(); active.current?.abort() }
  }, [service, checkAttempt])
  useEffect(() => { if (view !== 'checking') heading.current?.focus() }, [view])
  useEffect(() => { if (error && view === 'ready') feedback.current?.focus() }, [error, view])
  useEffect(() => { if (leaving) leaveHeading.current?.focus() }, [leaving])
  useEffect(() => {
    if (!dirty) return
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [dirty])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (inFlight.current || view !== 'ready') return
    const next = {
      password: !password ? 'passwordRequired' : !validNewPassword(password) ? 'resetLength' : undefined,
      confirmation: !confirmation ? 'resetConfirmRequired' : password !== confirmation ? 'resetMismatch' : undefined,
    } as typeof fields
    setFields(next); setError(null)
    if (next.password) { passwordInput.current?.focus(); return }
    if (next.confirmation) { confirmationInput.current?.focus(); return }
    if (!intent.current || intent.current.password !== password) intent.current = { password, key: crypto.randomUUID() }
    const controller = new AbortController(); active.current = controller
    inFlight.current = true; setBusy(true)
    try {
      await service.complete({ token: token.current, password, confirmation, idempotencyKey: intent.current.key }, controller.signal)
      if (!controller.signal.aborted) {
        setView('success'); setPassword(''); setConfirmation(''); token.current = ''; intent.current = null
        if (typeof BroadcastChannel !== 'undefined') {
          const channel = new BroadcastChannel('fgae.auth')
          channel.postMessage('credentials-changed'); channel.close()
        }
      }
    } catch (failure) {
      if (!controller.signal.aborted) {
        const code = failure instanceof ResetError ? failure.code : 'UNAVAILABLE'
        const end = terminal(code)
        if (end) { setView(end); setPassword(''); setConfirmation(''); intent.current = null }
        else { setError(errorKey(code)); requestAnimationFrame(() => feedback.current?.focus()) }
      }
    } finally { if (!controller.signal.aborted) { inFlight.current = false; setBusy(false) } }
  }

  function goBack(event: MouseEvent<HTMLAnchorElement>) {
    if (dirty && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.button === 0) { event.preventDefault(); setLeaving(true) }
  }
  function discard() {
    // Clear credentials before navigating; no password draft is persisted.
    setPassword(''); setConfirmation(''); intent.current = null
    active.current?.abort(); setLeaving(false)
    window.setTimeout(() => window.location.assign('/sign-in'), 0)
  }

  return <section className="sign-in recovery reset-password" aria-labelledby="reset-heading">
    {view !== 'success' && <a ref={backLink} href="/sign-in" onClick={goBack} className="text-link back-link"><ArrowLeftIcon size={17} aria-hidden="true" />{t('recoveryBack')}</a>}
    <div className="recovery-icon" aria-hidden="true">{view === 'success' ? <CheckCircleIcon size={29} /> : <LockKeyIcon size={29} />}</div>
    <p className="eyebrow form-eyebrow">{t('recoveryEyebrow')}</p>
    <h1 id="reset-heading" ref={heading} tabIndex={-1}>{t(headings[view])}</h1>
    <p className="form-subtitle">{t(descriptions[view])}</p>
    {view === 'checking' && <p className="reset-check" role="status"><span className="spinner" aria-hidden="true" />{t('resetChecking')}</p>}
    {error && <div ref={feedback} className="feedback error" tabIndex={-1} role="alert"><WarningCircleIcon size={22} aria-hidden="true" /><div><strong>{t('resetErrorTitle')}</strong><p>{t(error)}</p></div></div>}
    {view === 'ready' && <>
      {leaving && <section className="leave-confirmation" aria-labelledby="leave-heading">
        <h2 ref={leaveHeading} id="leave-heading" tabIndex={-1}>{t('resetLeaveHeading')}</h2><p>{t('resetLeave')}</p>
        <div className="leave-actions"><Button className="secondary" onClick={() => { setLeaving(false); backLink.current?.focus() }}>{t('resetKeepEditing')}</Button>
          <Button className="secondary" onClick={discard}>{t('resetDiscard')}</Button></div>
      </section>}
      <form onSubmit={event => void submit(event)} noValidate aria-busy={busy}>
        <div className="field">
          <label htmlFor="new-password">{t('resetNew')}</label>
          <div className="password-control"><input id="new-password" name="new-password" ref={passwordInput} type={show.password ? 'text' : 'password'}
            autoComplete="new-password" required value={password} readOnly={busy} placeholder={t('resetNewPlaceholder')}
            aria-invalid={!!fields.password} aria-describedby={fields.password ? 'reset-password-error password-requirements' : 'password-requirements'}
            onChange={event => { setPassword(event.target.value); setFields(old => ({ ...old, password: undefined })) }} />
            <Button className="reveal" aria-label={t(show.password ? 'resetHideNew' : 'resetShowNew')} aria-pressed={show.password}
              onClick={() => setShow(old => ({ ...old, password: !old.password }))}>{show.password ? <EyeSlashIcon size={22} aria-hidden="true" /> : <EyeIcon size={22} aria-hidden="true" />}</Button></div>
          {fields.password && <p id="reset-password-error" className="field-error">{t(fields.password)}</p>}
          <p id="password-requirements" className="field-hint">{t('resetRequirements')}</p>
        </div>
        <div className="field">
          <label htmlFor="confirm-password">{t('resetConfirm')}</label>
          <div className="password-control"><input id="confirm-password" name="confirm-password" ref={confirmationInput} type={show.confirmation ? 'text' : 'password'}
            autoComplete="new-password" required value={confirmation} readOnly={busy} placeholder={t('resetConfirmPlaceholder')}
            aria-invalid={!!fields.confirmation} aria-describedby={fields.confirmation ? 'reset-confirm-error' : undefined}
            onChange={event => { setConfirmation(event.target.value); setFields(old => ({ ...old, confirmation: undefined })) }} />
            <Button className="reveal" aria-label={t(show.confirmation ? 'resetHideConfirm' : 'resetShowConfirm')} aria-pressed={show.confirmation}
              onClick={() => setShow(old => ({ ...old, confirmation: !old.confirmation }))}>{show.confirmation ? <EyeSlashIcon size={22} aria-hidden="true" /> : <EyeIcon size={22} aria-hidden="true" />}</Button></div>
          {fields.confirmation && <p id="reset-confirm-error" className="field-error">{t(fields.confirmation)}</p>}
        </div>
        <Button type="submit" className="primary" disabled={busy}>{t(busy ? 'resetSubmitting' : 'resetSubmit')}{busy ? <span className="spinner" aria-hidden="true" /> : <ArrowRightIcon size={20} aria-hidden="true" />}</Button>
        <span className="sr-only" role="status">{busy ? t('resetSubmitting') : ''}</span>
        <p className="recovery-privacy">{t('resetSaveNote')}</p>
      </form>
    </>}
    {view === 'check-error' && <Button className="primary" onClick={() => { setError(null); setView('checking'); setCheckAttempt(old => old + 1) }}>{t('resetRetry')}</Button>}
    {['missing', 'invalid', 'expired', 'used'].includes(view) && <a className="primary action-link" href="/forgot-password">{t('resetRequestLink')}<ArrowRightIcon size={20} aria-hidden="true" /></a>}
    {view === 'success' && <div className="success-content"><a className="primary action-link" href="/sign-in">{t('resetSignIn')}<ArrowRightIcon size={20} aria-hidden="true" /></a><span className="sr-only" role="status">{t('resetSuccessHeading')}</span></div>}
    <aside className="account-help" aria-label={t('helpTitle')}><InfoIcon size={21} aria-hidden="true" /><div><h2>{t('helpTitle')}</h2><p>{t('help')}</p></div></aside>
  </section>
}
