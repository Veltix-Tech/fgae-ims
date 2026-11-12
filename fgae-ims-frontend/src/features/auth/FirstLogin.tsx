import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowRightIcon, CheckCircleIcon, EyeIcon, EyeSlashIcon, InfoIcon, LockKeyIcon, SignOutIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { authService } from '@auth-adapter'
import { firstLoginService } from '@first-login-adapter'
import { Button } from '../../components/Button'
import { useLocale } from '../../i18n/locale'
import type { TranslationKey } from '../../i18n/locales/en/auth'
import { AuthError, type Identity } from '../../services/contracts/auth'
import { FirstLoginError } from '../../services/contracts/first-login'
import { validNewPassword } from '../../services/contracts/reset-password'

type View = 'checking' | 'ready' | 'signed-out' | 'not-required' | 'check-error' | 'success'
type Field = 'current' | 'password' | 'confirmation'
const empty = { current: '', password: '', confirmation: '' }
const fields: { key: Field; id: string; label: TranslationKey; show: TranslationKey; hide: TranslationKey }[] = [
  { key: 'current', id: 'current-password', label: 'firstCurrent', show: 'firstShowCurrent', hide: 'firstHideCurrent' },
  { key: 'password', id: 'new-password', label: 'resetNew', show: 'resetShowNew', hide: 'resetHideNew' },
  { key: 'confirmation', id: 'confirm-password', label: 'resetConfirm', show: 'resetShowConfirm', hide: 'resetHideConfirm' },
]
const headings: Record<View, TranslationKey> = { checking: 'firstCheckingHeading', ready: 'firstHeading', 'signed-out': 'firstSignInHeading', 'not-required': 'firstDoneHeading', 'check-error': 'firstCheckFailed', success: 'resetSuccessHeading' }
const descriptions: Record<View, TranslationKey> = { checking: 'checking', ready: 'firstIntro', 'signed-out': 'firstSignInIntro', 'not-required': 'firstDoneIntro', 'check-error': 'firstUnavailable', success: 'firstSuccess' }
function message(error: unknown): TranslationKey {
  if (error instanceof AuthError || error instanceof FirstLoginError) {
    if (error.code === 'NETWORK' || error.code === 'RATE_LIMITED') return error.code
    return ({ WRONG_PASSWORD: 'firstWrong', SAME_PASSWORD: 'resetSame', PASSWORD_REJECTED: 'resetRejected', CONFIRMATION_MISMATCH: 'resetMismatch', STORAGE_UNAVAILABLE: 'resetStorage' } as Record<string, TranslationKey>)[error.code] ?? 'firstUnavailable'
  }
  return 'firstUnavailable'
}

export function FirstLogin() {
  const { t } = useLocale()
  const [view, setView] = useState<View>('checking')
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [values, setValues] = useState(empty)
  const [revealed, setRevealed] = useState({ current: false, password: false, confirmation: false })
  const [errors, setErrors] = useState<Partial<Record<Field, TranslationKey>>>({})
  const [error, setError] = useState<TranslationKey | null>(null)
  const [busy, setBusy] = useState<'save' | 'logout' | null>(null)
  const [leaving, setLeaving] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const feedback = useRef<HTMLDivElement>(null)
  const leaveHeading = useRef<HTMLHeadingElement>(null)
  const signOutButton = useRef<HTMLDivElement>(null)
  const inputs = useRef<Partial<Record<Field, HTMLInputElement | null>>>({})
  const active = useRef<AbortController | null>(null)
  const inFlight = useRef(false)
  const completed = useRef(false)
  const intent = useRef<{ payload: string; key: string } | null>(null)
  const dirty = view === 'ready' && Object.values(values).some(Boolean)

  useEffect(() => {
    const controller = new AbortController(); active.current = controller
    authService.restore(controller.signal).then(user => {
      if (controller.signal.aborted) return
      setIdentity(user); setView(!user ? 'signed-out' : user.mustChangePassword ? 'ready' : 'not-required')
    }).catch(failure => {
      if (controller.signal.aborted) return
      setView(failure instanceof AuthError && failure.code === 'SESSION_EXPIRED' ? 'signed-out' : 'check-error')
      if (!(failure instanceof AuthError && failure.code === 'SESSION_EXPIRED')) setError(message(failure))
    })
    return () => { controller.abort(); active.current?.abort() }
  }, [attempt])
  useEffect(() => {
    const loseSession = () => {
      if (completed.current) return
      active.current?.abort(); inFlight.current = false; setBusy(null)
      setValues(empty); intent.current = null; setError(null); setLeaving(false); setIdentity(null); setView('signed-out')
    }
    const bus = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('fgae.auth') : null
    if (bus) bus.onmessage = loseSession
    const controller = new AbortController()
    let checking = false
    const verify = async () => {
      if (view !== 'ready' || inFlight.current || checking) return
      checking = true
      try {
        const user = await authService.restore(controller.signal)
        if (!controller.signal.aborted && (!user || user.id !== identity?.id || !user.mustChangePassword)) loseSession()
      } catch (failure) {
        if (!controller.signal.aborted && failure instanceof AuthError && failure.code === 'SESSION_EXPIRED') loseSession()
      } finally { checking = false }
    }
    const timer = window.setInterval(() => void verify(), 60_000)
    window.addEventListener('focus', verify)
    return () => { bus?.close(); controller.abort(); clearInterval(timer); window.removeEventListener('focus', verify) }
  }, [view, identity?.id])
  useEffect(() => { if (view !== 'checking') heading.current?.focus() }, [view])
  useEffect(() => { if (error) feedback.current?.focus() }, [error])
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
    const next: Partial<Record<Field, TranslationKey>> = {
      current: !values.current ? 'firstCurrentRequired' : undefined,
      password: !values.password ? 'passwordRequired' : !validNewPassword(values.password) ? 'resetLength' : values.password === values.current ? 'resetSame' : undefined,
      confirmation: !values.confirmation ? 'resetConfirmRequired' : values.password !== values.confirmation ? 'resetMismatch' : undefined,
    }
    setErrors(next); setError(null)
    const invalid = fields.find(field => next[field.key])
    if (invalid) { inputs.current[invalid.key]?.focus(); return }
    const payload = JSON.stringify(values)
    if (intent.current?.payload !== payload) intent.current = { payload, key: crypto.randomUUID() }
    const controller = new AbortController(); active.current = controller
    inFlight.current = true; setBusy('save')
    try {
      await firstLoginService.complete({ currentPassword: values.current, password: values.password, confirmation: values.confirmation, idempotencyKey: intent.current.key }, controller.signal)
      if (!controller.signal.aborted) {
        completed.current = true; setValues(empty); intent.current = null; setError(null); setLeaving(false); setView('success')
        const bus = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('fgae.auth') : null
        bus?.postMessage('credentials-changed'); bus?.close()
      }
    } catch (failure) {
      if (controller.signal.aborted) return
      if ((failure instanceof AuthError || failure instanceof FirstLoginError) && (failure.code === 'SESSION_EXPIRED' || failure.code === 'NOT_REQUIRED')) {
        setValues(empty); intent.current = null; setLeaving(false)
        setView(failure.code === 'NOT_REQUIRED' ? 'not-required' : 'signed-out')
      } else { setError(message(failure)); requestAnimationFrame(() => feedback.current?.focus()) }
    } finally { if (!controller.signal.aborted) { inFlight.current = false; setBusy(null) } }
  }
  async function signOut() {
    if (inFlight.current) return
    inFlight.current = true; setBusy('logout'); setError(null)
    const controller = new AbortController(); active.current = controller
    try {
      await authService.signOut()
      if (controller.signal.aborted) return
      setValues(empty); intent.current = null; setLeaving(false); setIdentity(null); setView('signed-out')
      const bus = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('fgae.auth') : null
      bus?.postMessage('signed-out'); bus?.close()
    } catch { if (!controller.signal.aborted) { setError('logoutFailed'); requestAnimationFrame(() => feedback.current?.focus()) } }
    finally { if (!controller.signal.aborted) { inFlight.current = false; setBusy(null) } }
  }
  return <section className="sign-in recovery first-login" aria-labelledby="first-heading">
    <div className="recovery-icon" aria-hidden="true">{view === 'success' ? <CheckCircleIcon size={29} /> : <LockKeyIcon size={29} />}</div>
    <p className="eyebrow form-eyebrow">{t('firstEyebrow')}</p>
    <h1 id="first-heading" ref={heading} tabIndex={-1}>{t(headings[view])}</h1>
    <p className="form-subtitle">{t(descriptions[view])}</p>
    {view === 'checking' && <p className="session-check" role="status"><span className="spinner" aria-hidden="true" />{t('checking')}</p>}
    {error && <div ref={feedback} className="feedback error" role="alert" tabIndex={-1}><WarningCircleIcon size={22} aria-hidden="true" /><div><strong>{t('firstErrorTitle')}</strong><p>{t(error)}</p></div></div>}
    {view === 'ready' && <>
      <div className="recovery-email"><span className="small-label">{t('accountLabel')}</span><strong>{identity?.email}</strong></div>
      {leaving && <section className="leave-confirmation" aria-labelledby="leave-heading">
        <h2 id="leave-heading" ref={leaveHeading} tabIndex={-1}>{t('resetLeaveHeading')}</h2><p>{t('firstLeave')}</p>
        <div className="leave-actions"><Button className="secondary" disabled={!!busy} onClick={() => { setLeaving(false); signOutButton.current?.querySelector('button')?.focus() }}>{t('resetKeepEditing')}</Button>
          <Button className="secondary" disabled={!!busy} onClick={() => void signOut()}>{t('firstDiscardSignOut')}</Button></div>
      </section>}
      <form onSubmit={event => void submit(event)} noValidate aria-busy={busy === 'save'}>
        {fields.map(field => <div className="field" key={field.key}>
          <label htmlFor={field.id}>{t(field.label)}</label>
          <div className="password-control"><input id={field.id} name={field.id} ref={node => { inputs.current[field.key] = node }}
            type={revealed[field.key] ? 'text' : 'password'} autoComplete={field.key === 'current' ? 'current-password' : 'new-password'}
            required readOnly={!!busy} value={values[field.key]} aria-invalid={!!errors[field.key]}
            aria-describedby={[errors[field.key] ? `${field.id}-error` : '', field.key === 'password' ? 'password-requirements' : ''].filter(Boolean).join(' ') || undefined}
            onChange={event => { setValues(old => ({ ...old, [field.key]: event.target.value })); setErrors(old => ({ ...old, [field.key]: undefined })) }} />
            <Button className="reveal" aria-label={t(revealed[field.key] ? field.hide : field.show)} aria-pressed={revealed[field.key]}
              onClick={() => setRevealed(old => ({ ...old, [field.key]: !old[field.key] }))}>{revealed[field.key] ? <EyeSlashIcon size={22} aria-hidden="true" /> : <EyeIcon size={22} aria-hidden="true" />}</Button></div>
          {errors[field.key] && <p id={`${field.id}-error`} className="field-error">{t(errors[field.key]!)}</p>}
          {field.key === 'password' && <p id="password-requirements" className="field-hint">{t('resetRequirements')}</p>}
        </div>)}
        <Button className="primary" type="submit" disabled={!!busy}>{t(busy === 'save' ? 'resetSubmitting' : 'firstSubmit')}{busy === 'save' ? <span className="spinner" aria-hidden="true" /> : <ArrowRightIcon size={20} aria-hidden="true" />}</Button>
        <span className="sr-only" role="status">{busy === 'save' ? t('resetSubmitting') : ''}</span>
        <p className="recovery-privacy">{t('firstRestriction')}</p>
      </form>
      <div ref={signOutButton}><Button className="secondary recovery-change" disabled={!!busy} onClick={() => dirty ? setLeaving(true) : void signOut()}>{t(busy === 'logout' ? 'signingOut' : 'signOut')}<SignOutIcon size={18} aria-hidden="true" /></Button></div>
    </>}
    {view === 'check-error' && <Button className="primary" onClick={() => { setError(null); setView('checking'); setAttempt(old => old + 1) }}>{t('resetRetry')}</Button>}
    {['signed-out', 'not-required', 'success'].includes(view) && <a className="primary action-link" href="/sign-in">{t('resetSignIn')}<ArrowRightIcon size={20} aria-hidden="true" /></a>}
    <aside className="account-help" aria-label={t('helpTitle')}><InfoIcon size={21} aria-hidden="true" /><div><h2>{t('helpTitle')}</h2><p>{t('help')}</p></div></aside>
  </section>
}
