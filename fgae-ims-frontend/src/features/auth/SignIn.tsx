import { Button } from '../../components/Button'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowRightIcon, CheckCircleIcon, EyeIcon, EyeSlashIcon, InfoIcon, SignOutIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { authService } from '@auth-adapter'
import { AuthError, type AuthService, type Identity } from '../../services/contracts/auth'
import { useLocale } from '../../i18n/locale'
import type { TranslationKey } from '../../i18n/locales/en/auth'
import { nextJourney } from '../../permissions/session-policy'
import { validateSignIn } from './validation'

const journeyCopy = { 'password-change': 'passwordChange', application: 'application', workspace: 'workspace', 'no-access': 'noAccess' } as const

export function SignIn({ service = authService, protectedEntry = false }: { service?: AuthService; protectedEntry?: boolean }) {
  const { t } = useLocale()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [fields, setFields] = useState<ReturnType<typeof validateSignIn>>({})
  const [error, setError] = useState<TranslationKey | null>(null)
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [busy, setBusy] = useState<'restore' | 'login' | 'logout' | null>('restore')
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const feedbackRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const inFlight = useRef(false)
  const activeRequest = useRef<AbortController | null>(null)
  const channel = useRef<BroadcastChannel | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    const controller = new AbortController()
    activeRequest.current = controller
    service.restore(controller.signal).then(user => {
      if (!controller.signal.aborted) setIdentity(user)
    }).catch(failure => {
      if (!controller.signal.aborted) setError(failure instanceof AuthError ? failure.code : 'UNAVAILABLE')
    }).finally(() => { if (!controller.signal.aborted) setBusy(null) })
    return () => { mounted.current = false; controller.abort(); activeRequest.current?.abort() }
  }, [service])

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const bus = new BroadcastChannel('fgae.auth')
    channel.current = bus
    bus.onmessage = () => {
      activeRequest.current?.abort()
      setIdentity(null); setPassword(''); setError('sessionLost'); setBusy(null); inFlight.current = false
    }
    return () => { channel.current = null; bus.close() }
  }, [])

  useEffect(() => { if (error) feedbackRef.current?.focus() }, [error])
  useEffect(() => { if (identity) headingRef.current?.focus() }, [identity])

  useEffect(() => {
    if (!identity) return
    let stopped = false
    let checking = false
    const controller = new AbortController()
    const verify = async () => {
      if (checking || inFlight.current) return
      checking = true
      try {
        const current = await service.restore(controller.signal)
        if (!stopped && (!current || current.id !== identity.id)) {
          setIdentity(null); setError('SESSION_EXPIRED')
        }
      } catch (failure) {
        if (!stopped && failure instanceof AuthError && failure.code === 'SESSION_EXPIRED') {
          setIdentity(null); setError('SESSION_EXPIRED')
        }
      } finally { checking = false }
    }
    const timer = window.setInterval(() => void verify(), 60_000)
    window.addEventListener('focus', verify)
    return () => { stopped = true; controller.abort(); clearInterval(timer); window.removeEventListener('focus', verify) }
  }, [identity, service])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (inFlight.current || busy) return
    const invalid = validateSignIn({ email, password })
    setFields(invalid); setError(null)
    if (invalid.email) { emailRef.current?.focus(); return }
    if (invalid.password) { passwordRef.current?.focus(); return }
    inFlight.current = true; setBusy('login')
    const controller = new AbortController()
    activeRequest.current = controller
    try {
      const user = await service.signIn({ email: email.trim(), password }, controller.signal)
      if (!controller.signal.aborted && mounted.current) {
        setIdentity(user); setPassword(''); setRevealed(false); channel.current?.postMessage('account-changed')
      }
    } catch (failure) {
      if (!controller.signal.aborted && mounted.current) setError(failure instanceof AuthError ? failure.code : 'UNAVAILABLE')
    } finally {
      if (!controller.signal.aborted && mounted.current) { setBusy(null); inFlight.current = false }
    }
  }

  async function signOut() {
    if (inFlight.current) return
    inFlight.current = true; setBusy('logout'); setError(null)
    try {
      await service.signOut()
      if (mounted.current) { setIdentity(null); setPassword(''); setEmail(''); channel.current?.postMessage('signed-out'); requestAnimationFrame(() => emailRef.current?.focus()) }
    } catch { if (mounted.current) setError('logoutFailed') }
    finally { if (mounted.current) { setBusy(null); inFlight.current = false } }
  }

  return <section className="sign-in" aria-labelledby="sign-in-heading">
    <div className="section-marker" aria-hidden="true" />
    <p className="eyebrow form-eyebrow">{t('system')}</p>
    <h1 id="sign-in-heading" ref={headingRef} tabIndex={-1}>{t(identity ? 'signedIn' : 'welcome')}</h1>
    <p className="form-subtitle">{identity ? t(journeyCopy[nextJourney(identity)]) : t('subtitle')}</p>

    {error && <div className="feedback error" role="alert" tabIndex={-1} ref={feedbackRef}>
      <WarningCircleIcon size={22} aria-hidden="true" /><div><strong>{t(error === 'logoutFailed' ? 'logoutFailed' : 'errorTitle')}</strong>
        {error !== 'logoutFailed' && <p>{t(error)}</p>}</div>
    </div>}

    {busy === 'restore' ? <p role="status" className="session-check"><span className="spinner" aria-hidden="true" />{t('checking')}</p> : identity ? <div className="success-content">
      <div className="account-summary" role="status">
        <CheckCircleIcon size={26} aria-hidden="true" /><div><span className="small-label">{t('accountLabel')}</span><strong>{identity.name}</strong><p>{identity.email}</p></div>
      </div>
      {identity.grants.length > 0 && <div className="role-list"><span className="small-label">{t('rolesLabel')}</span><p>{[...new Set(identity.grants.map(g => g.role))].map(role => t(role)).join(' · ')}</p></div>}
      <Button className="primary" disabled={busy === 'logout'} onClick={() => void signOut()}>{t(busy === 'logout' ? 'signingOut' : 'signOut')}<SignOutIcon size={20} aria-hidden="true" /></Button>
    </div> : <form onSubmit={event => void submit(event)} noValidate aria-busy={busy === 'login'}>
      {protectedEntry && !error && <p className="entry-notice">{t('sessionNotice')}</p>}
      <div className="field">
        <label htmlFor="email">{t('email')}</label>
        <input ref={emailRef} id="email" name="email" type="email" autoComplete="username" inputMode="email" autoCapitalize="none" spellCheck={false}
          required value={email} onChange={event => { setEmail(event.target.value); setFields(old => ({ ...old, email: undefined })) }}
          placeholder={t('emailPlaceholder')} aria-invalid={!!fields.email} aria-describedby={fields.email ? 'email-error' : 'email-hint'} readOnly={busy === 'login'} />
        {fields.email ? <p id="email-error" className="field-error">{t(fields.email)}</p> : <p id="email-hint" className="field-hint">{t('accessNote')}</p>}
      </div>
      <div className="field password-field">
        <label htmlFor="password">{t('password')}</label>
        <div className="password-control">
          <input ref={passwordRef} id="password" name="password" type={revealed ? 'text' : 'password'} autoComplete="current-password" required
            value={password} onChange={event => { setPassword(event.target.value); setFields(old => ({ ...old, password: undefined })) }}
            placeholder={t('passwordPlaceholder')} aria-invalid={!!fields.password} aria-describedby={fields.password ? 'password-error' : undefined} readOnly={busy === 'login'} />
          <Button type="button" className="reveal" aria-label={t(revealed ? 'hidePassword' : 'showPassword')} aria-pressed={revealed} onClick={() => setRevealed(!revealed)}>
            {revealed ? <EyeSlashIcon size={22} aria-hidden="true" /> : <EyeIcon size={22} aria-hidden="true" />}
          </Button>
        </div>
        {fields.password && <p id="password-error" className="field-error">{t(fields.password)}</p>}
      </div>
      <Button type="submit" className="primary" disabled={busy === 'login'}>
        {t(busy === 'login' ? 'signingIn' : 'signIn')}{busy === 'login' ? <span className="spinner" aria-hidden="true" /> : <ArrowRightIcon size={20} aria-hidden="true" />}
      </Button>
      <span className="sr-only" role="status">{busy === 'login' ? t('signingIn') : ''}</span>
      <div className="forgot-link"><a href="/forgot-password" className="text-link">{t('forgotPassword')}</a></div>
    </form>}
    <aside className="account-help" aria-label={t('helpTitle')}><InfoIcon size={21} aria-hidden="true" /><div><h2>{t('helpTitle')}</h2><p>{t('help')}</p></div></aside>
  </section>
}
