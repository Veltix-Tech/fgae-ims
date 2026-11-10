import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeftIcon, ArrowRightIcon, CheckCircleIcon, EnvelopeSimpleIcon, InfoIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { recoveryService } from '@recovery-adapter'
import { Button } from '../../components/Button'
import { useLocale } from '../../i18n/locale'
import type { TranslationKey } from '../../i18n/locales/en/auth'
import { RecoveryError, validRecoveryEmail, type RecoveryService } from '../../services/contracts/recovery'

export function ForgotPassword({ service = recoveryService }: { service?: RecoveryService }) {
  const { locale, t } = useLocale()
  const [receipt, setReceipt] = useState(() => service.restoreReceipt())
  const [email, setEmail] = useState(() => receipt?.email ?? '')
  const [fieldError, setFieldError] = useState<TranslationKey | null>(null)
  const [error, setError] = useState<TranslationKey | null>(null)
  const [busy, setBusy] = useState(false)
  const [retryAt, setRetryAt] = useState(() => receipt?.retryAt ?? 0)
  const [now, setNow] = useState(Date.now)
  const emailRef = useRef<HTMLInputElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const active = useRef<AbortController | null>(null)
  const inFlight = useRef(false)
  const attempt = useRef<{ email: string; key: string } | null>(null)
  const remaining = Math.max(0, Math.ceil((retryAt - now) / 1000))

  useEffect(() => () => active.current?.abort(), [])
  useEffect(() => { if (receipt) headingRef.current?.focus() }, [receipt])
  useEffect(() => { if (error) errorRef.current?.focus() }, [error])
  useEffect(() => {
    if (remaining <= 0) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [remaining])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (inFlight.current || Date.now() < retryAt) return
    const value = email.trim()
    const invalid = !value ? 'emailRequired' : !validRecoveryEmail(value) ? 'emailInvalid' : null
    setFieldError(invalid); setError(null)
    if (invalid) { emailRef.current?.focus(); return }
    if (!attempt.current || attempt.current.email !== value) attempt.current = { email: value, key: crypto.randomUUID() }
    const controller = new AbortController()
    active.current = controller
    inFlight.current = true; setBusy(true)
    try {
      const result = await service.request({ email: value, locale, idempotencyKey: attempt.current.key }, controller.signal)
      if (!controller.signal.aborted) {
        setEmail(value); setReceipt(result); setRetryAt(result.retryAt); setNow(Date.now()); attempt.current = null
      }
    } catch (failure) {
      if (!controller.signal.aborted) {
        const code = failure instanceof RecoveryError ? failure.code : 'UNAVAILABLE'
        setError(code === 'NETWORK' ? 'NETWORK' : code === 'RATE_LIMITED' ? 'RATE_LIMITED' :
          code === 'INVALID_EMAIL' ? 'emailInvalid' : code === 'STORAGE_UNAVAILABLE' ? 'recoveryStorage' : 'recoveryUnavailable')
        if (failure instanceof RecoveryError && code === 'RATE_LIMITED') {
          setRetryAt(Date.now() + Math.max(1, failure.retryAfterSeconds) * 1000); setNow(Date.now())
        }
      }
    } finally {
      if (!controller.signal.aborted) { setBusy(false); inFlight.current = false }
    }
  }

  function changeEmail() {
    service.clearReceipt(); setReceipt(null); setError(null); setFieldError(null); attempt.current = null
    requestAnimationFrame(() => { emailRef.current?.focus(); emailRef.current?.select() })
  }

  return <section className="sign-in recovery" aria-labelledby="recovery-heading">
    <a href="/sign-in" className="text-link back-link"><ArrowLeftIcon size={17} aria-hidden="true" />{t('recoveryBack')}</a>
    <div className="recovery-icon" aria-hidden="true">{receipt ? <CheckCircleIcon size={29} /> : <EnvelopeSimpleIcon size={29} />}</div>
    <p className="eyebrow form-eyebrow">{t('recoveryEyebrow')}</p>
    <h1 id="recovery-heading" ref={headingRef} tabIndex={-1}>{t(receipt ? 'recoveryReceived' : 'recoveryHeading')}</h1>
    <p className="form-subtitle">{t(receipt ? 'recoveryConfirmation' : 'recoveryIntro')}</p>
    {error && <div ref={errorRef} className="feedback error" role="alert" tabIndex={-1}>
      <WarningCircleIcon size={22} aria-hidden="true" /><div><strong>{t('recoveryErrorTitle')}</strong><p>{t(error)}</p></div>
    </div>}
    <form onSubmit={event => void submit(event)} noValidate aria-busy={busy}>
      {receipt ? <div className="success-content">
        <div className="recovery-address"><span className="small-label">{t('recoveryEmailLabel')}</span><strong>{receipt.email}</strong></div>
        <p className="recovery-inbox">{t('recoveryInbox')}</p>
      </div> : <div className="field">
        <label htmlFor="recovery-email">{t('email')}</label>
        <input id="recovery-email" ref={emailRef} name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
          required maxLength={254} value={email} readOnly={busy} placeholder={t('emailPlaceholder')} aria-invalid={!!fieldError}
          aria-describedby={fieldError ? 'recovery-email-error' : 'recovery-email-hint'}
          onChange={event => { setEmail(event.target.value); setFieldError(null) }} />
        {fieldError ? <p id="recovery-email-error" className="field-error">{t(fieldError)}</p> : <p id="recovery-email-hint" className="field-hint">{t('accessNote')}</p>}
      </div>}
      <Button type="submit" className="primary" disabled={busy || remaining > 0} aria-describedby={remaining > 0 ? 'recovery-cooldown' : undefined}>
        {t(busy ? 'recoverySubmitting' : receipt ? 'recoveryResend' : 'recoverySubmit')}
        {busy ? <span className="spinner" aria-hidden="true" /> : <ArrowRightIcon size={20} aria-hidden="true" />}
      </Button>
      <span className="sr-only" role="status">{busy ? t('recoverySubmitting') : receipt ? t('recoveryReceived') : ''}</span>
      {(remaining > 0 || receipt) && <p className="recovery-cooldown" id="recovery-cooldown">{remaining > 0 ?
        t('recoveryCooldown').replace('{seconds}', new Intl.NumberFormat(locale === 'am' ? 'am-ET' : 'en-ET').format(remaining)) : t('recoveryReady')}</p>}
      {receipt && <Button className="secondary recovery-change" disabled={busy} onClick={changeEmail}>{t('recoveryChange')}</Button>}
    </form>
    {!receipt && <p className="recovery-privacy">{t('recoveryPrivacy')}</p>}
    <aside className="account-help" aria-label={t('recoveryHelpHeading')}><InfoIcon size={21} aria-hidden="true" />
      <div><h2>{t('recoveryHelpHeading')}</h2><p>{t('recoveryHelp')}</p></div>
    </aside>
  </section>
}
