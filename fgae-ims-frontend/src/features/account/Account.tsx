import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { ArrowLeftIcon, CheckCircleIcon, EyeIcon, EyeSlashIcon, SignOutIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { accountService as service } from '@account-adapter'
import { authService } from '@auth-adapter'
import { Button } from '../../components/Button'
import { RegistrationDocument } from '../auth/RegistrationDocument'
import { useLocale } from '../../i18n/locale'
import type { TranslationKey } from '../../i18n/locales/en/auth'
import { accountFields, photoRule, type AccountProfile, type AccountSnapshot } from '../../services/contracts/account'
import { validNewPassword } from '../../services/contracts/reset-password'

const emptyPasswords = { currentPassword: '', password: '', confirmation: '' }
type PasswordField = keyof typeof emptyPasswords
const passwordLabels: Record<PasswordField, TranslationKey> = { currentPassword: 'acctCurrent', password: 'resetNew', confirmation: 'resetConfirm' }
function errorKey(failure: unknown): TranslationKey {
  const code = failure instanceof Error && 'code' in failure ? String(failure.code) : ''
  return ({ SESSION_EXPIRED: 'acctSignIn', FORBIDDEN: 'acctDenied', CONFLICT: 'acctConflict', WRONG_PASSWORD: 'acctWrongPassword', SAME_PASSWORD: 'resetSame', PASSWORD_REJECTED: 'resetRejected', CONFIRMATION_MISMATCH: 'resetMismatch', VALIDATION: 'acctValidation', FILE_TYPE: 'regFileType', FILE_SIZE: 'regFileSize', DOCUMENT_MISSING: 'regDocumentMissing', NETWORK: 'NETWORK', RATE_LIMITED: 'RATE_LIMITED', STORAGE_UNAVAILABLE: 'regStorage' } as Partial<Record<string, TranslationKey>>)[code] ?? 'acctUnavailable'
}
export function Account() {
  const { t, setLocale } = useLocale()
  const [snapshot, setSnapshot] = useState<AccountSnapshot | null>(null)
  const [profile, setProfile] = useState<AccountProfile | null>(null)
  const [passwords, setPasswords] = useState(emptyPasswords)
  const [show, setShow] = useState<Partial<Record<PasswordField, boolean>>>({})
  const [busy, setBusy] = useState<'load' | 'save' | 'password' | 'logout' | null>('load')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<TranslationKey | null>(null)
  const [notice, setNotice] = useState<TranslationKey | null>(null)
  const [invalid, setInvalid] = useState<Partial<Record<'name' | 'phone' | PasswordField, TranslationKey>>>({})
  const [decision, setDecision] = useState<'discard' | 'leave' | 'reload' | 'logout' | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [done, setDone] = useState(false)
  const active = useRef<AbortController | null>(null)
  const inFlight = useRef(false); const allowLeave = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null); const feedback = useRef<HTMLDivElement>(null); const decisionHeading = useRef<HTMLHeadingElement>(null)
  const intent = useRef<{ payload: string; key: string } | null>(null)
  const channelSource = useRef(crypto.randomUUID())
  const profileDirty = !!profile && JSON.stringify(profile) !== JSON.stringify(snapshot?.profile)
  const dirty = !done && !!snapshot && (profileDirty || Object.values(passwords).some(Boolean) || uploading)
  const disabled = !!busy || uploading || !!decision
  const conflict = error === 'acctConflict'
  function loseSession() { active.current?.abort(); inFlight.current = false; intent.current = null; setSnapshot(null); setProfile(null); setPasswords(emptyPasswords); setShow({}); setInvalid({}); setNotice(null); setUploading(false); setBusy(null); setDecision(null); setError('acctSignIn'); setDone(false) }
  function failure(value: unknown) { const key = errorKey(value); if (key === 'acctSignIn' || key === 'acctDenied') { loseSession(); setError(key) } else setError(key) }
  useEffect(() => {
    const controller = new AbortController(); active.current = controller
    service.load(controller.signal).then(value => { if (!controller.signal.aborted) { setSnapshot(value); setProfile(value.profile); setPasswords(emptyPasswords); setShow({}) } })
      .catch(value => { if (!controller.signal.aborted) setError(errorKey(value)) }).finally(() => { if (!controller.signal.aborted) setBusy(null) })
    return () => { controller.abort(); active.current?.abort() }
  }, [attempt])
  useEffect(() => { const bus = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('fgae.auth') : null; if (bus) bus.onmessage = event => { if (event.data?.source !== channelSource.current) loseSession() }; return () => bus?.close() }, [])
  useEffect(() => {
    if (!snapshot || done) return
    const controller = new AbortController(); let checking = false
    const verify = async () => {
      if (checking || inFlight.current || document.hidden) return
      checking = true
      try { const identity = await authService.restore(controller.signal); if (!controller.signal.aborted && (!identity || identity.id !== snapshot.identity.id || identity.mustChangePassword)) loseSession() }
      catch (value) { if (!controller.signal.aborted && errorKey(value) === 'acctSignIn') loseSession() }
      finally { checking = false }
    }
    const timer = window.setInterval(() => void verify(), 60_000); window.addEventListener('focus', verify)
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener('focus', verify) }
  }, [snapshot, done])
  useEffect(() => { if (!dirty) return; const guard = (event: BeforeUnloadEvent) => { if (!allowLeave.current) { event.preventDefault(); event.returnValue = '' } }; window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard) }, [dirty])
  useEffect(() => { if (error) { if (feedback.current) feedback.current.focus(); else heading.current?.focus() } }, [error])
  useEffect(() => { if (decision) decisionHeading.current?.focus() }, [decision])
  useEffect(() => { if (done || notice) heading.current?.focus() }, [done, notice])
  function focus(key: string) { requestAnimationFrame(() => document.getElementById(`acct-${key}`)?.focus()) }
  async function save(event: FormEvent) {
    event.preventDefault(); if (disabled || conflict || inFlight.current || !profile || !snapshot) return
    const errors = accountFields(profile); setInvalid(errors); setError(null); setNotice(null)
    if (errors.name || errors.phone) { focus(errors.name ? 'name' : 'phone'); return }
    const controller = new AbortController(); active.current = controller; inFlight.current = true; setBusy('save')
    try { const result = await service.save(profile, controller.signal); if (!controller.signal.aborted) { setProfile(result); setSnapshot({ identity: { ...snapshot.identity, name: result.name }, profile: result }); setNotice('acctSaved') } }
    catch (value) { if (!controller.signal.aborted) failure(value) }
    finally { if (!controller.signal.aborted) { inFlight.current = false; setBusy(null) } }
  }
  async function changePassword(event: FormEvent) {
    event.preventDefault(); if (disabled || inFlight.current) return
    setError(null); setNotice(null)
    if (profileDirty) { setError('acctProfileFirst'); return }
    const errors: typeof invalid = { currentPassword: !passwords.currentPassword ? 'acctCurrentRequired' : undefined, password: !validNewPassword(passwords.password) ? 'resetLength' : undefined, confirmation: !passwords.confirmation ? 'resetConfirmRequired' : passwords.password !== passwords.confirmation ? 'resetMismatch' : undefined }
    setInvalid(errors); const first = Object.keys(errors).find(key => errors[key as PasswordField]); if (first) { focus(first); return }
    const payload = JSON.stringify(passwords); if (intent.current?.payload !== payload) intent.current = { payload, key: crypto.randomUUID() }
    const controller = new AbortController(); active.current = controller; inFlight.current = true; setBusy('password')
    try {
      await service.password({ ...passwords, idempotencyKey: intent.current.key }, controller.signal)
      if (!controller.signal.aborted) {
        setPasswords(emptyPasswords); setShow({}); setProfile(null); setSnapshot(null); setDone(true); intent.current = null
        const bus = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('fgae.auth') : null; bus?.postMessage({ type: 'credentials-changed', source: channelSource.current }); bus?.close()
      }
    } catch (value) { if (!controller.signal.aborted) { failure(value); if (errorKey(value) === 'acctWrongPassword') focus('currentPassword') } }
    finally { if (!controller.signal.aborted) { inFlight.current = false; setBusy(null) } }
  }
  async function logout() {
    if (inFlight.current) return
    inFlight.current = true; setBusy('logout'); setError(null)
    try { await authService.signOut(); loseSession(); const bus = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('fgae.auth') : null; bus?.postMessage('signed-out'); bus?.close() }
    catch { setError('logoutFailed') } finally { inFlight.current = false; setBusy(null) }
  }
  function leave(event: MouseEvent<HTMLAnchorElement>) { if (dirty && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.button === 0) { event.preventDefault(); setDecision('leave') } }
  function decide() {
    if (decision === 'leave') { allowLeave.current = true; active.current?.abort(); window.location.assign('/sign-in'); return }
    if (decision === 'logout') { setDecision(null); void logout(); return }
    if (decision === 'reload') { setSnapshot(null); setProfile(null); setPasswords(emptyPasswords); setError(null); setNotice(null); setBusy('load'); setAttempt(old => old + 1) }
    else { intent.current = null; setProfile(snapshot!.profile); setLocale(snapshot!.profile.locale); setPasswords(emptyPasswords); setShow({}); setInvalid({}); setNotice(null) }
    setDecision(null)
  }
  const gate = error === 'acctSignIn' || error === 'acctDenied'
  return <section className="account-page motion-enter" aria-labelledby="account-heading" aria-busy={!!busy}>
    <a href="/sign-in" className="back-link text-link" onClick={leave}><ArrowLeftIcon size={18} aria-hidden="true" />{t('appAccount')}</a>
    <div className="application-heading"><div><p className="eyebrow">{t('accountLabel')}</p><h1 id="account-heading" ref={heading} tabIndex={-1}>{t(done ? 'acctPasswordDone' : gate ? error : 'acctHeading')}</h1><p className="form-subtitle">{t(done ? 'acctPasswordDoneNote' : error === 'acctSignIn' ? 'acctSignInNote' : error === 'acctDenied' ? 'acctDeniedNote' : 'acctIntro')}</p></div>{snapshot && <Button className="secondary application-signout" disabled={disabled} onClick={() => dirty ? setDecision('logout') : void logout()}><SignOutIcon size={18} aria-hidden="true" />{t(busy === 'logout' ? 'signingOut' : 'signOut')}</Button>}</div>
    {error && !gate && <div className="feedback error" role="alert" ref={feedback} tabIndex={-1}><WarningCircleIcon size={22} aria-hidden="true" /><div><strong>{t('regErrorTitle')}</strong><p>{t(error)}</p>{conflict && <Button className="text-button" disabled={!!busy || uploading} onClick={() => setDecision('reload')}>{t('acctReload')}</Button>}</div></div>}
    {notice && <p className="registration-notice" role="status">{t(notice)}</p>}
    {decision && <section className="leave-confirmation"><h2 ref={decisionHeading} tabIndex={-1}>{t(decision === 'discard' ? 'acctDiscardTitle' : decision === 'reload' ? 'acctReloadTitle' : 'acctLeave')}</h2><p>{t(decision === 'discard' ? 'acctDiscardBody' : decision === 'reload' ? 'acctReloadBody' : 'acctLeaveBody')}</p><div className="leave-actions"><Button className="secondary" onClick={() => { setDecision(null); heading.current?.focus() }}>{t('acctKeep')}</Button><Button className="secondary" onClick={decide}>{t(decision === 'discard' ? 'acctDiscard' : decision === 'reload' ? 'acctReload' : decision === 'logout' ? 'signOut' : 'acctLeaveAction')}</Button></div></section>}
    {busy === 'load' ? <p className="session-check" role="status"><span className="spinner" aria-hidden="true" />{t('acctLoading')}</p> : done || gate ? <div className="application-state">{done && <CheckCircleIcon size={32} aria-hidden="true" />}<a href="/sign-in" className="primary action-link">{t('signIn')}</a></div> : !snapshot || !profile ? <Button className="primary account-retry" onClick={() => { setError(null); setBusy('load'); setAttempt(old => old + 1) }}>{t('appRetry')}</Button> : <>
      <form onSubmit={event => void save(event)} noValidate><div className="account-columns">
        <section className="application-card account-fields" aria-labelledby="profile-heading"><h2 id="profile-heading">{t('acctProfile')}</h2><p className="step-intro">{t('acctAllowed')}</p>
          {(['name', 'phone'] as const).map(key => <div className="field" key={key}><label htmlFor={`acct-${key}`}>{t(key === 'name' ? 'regFullName' : 'regPhone')}</label><input id={`acct-${key}`} type={key === 'phone' ? 'tel' : 'text'} autoComplete={key === 'phone' ? 'tel' : 'name'} value={profile[key]} maxLength={key === 'name' ? 150 : undefined} required={key === 'name'} disabled={disabled || conflict || !profile.editableFields.includes(key)} aria-invalid={!!invalid[key]} aria-describedby={invalid[key] ? `acct-${key}-error` : undefined} onChange={event => { setProfile({ ...profile, [key]: event.target.value }); setInvalid(old => ({ ...old, [key]: undefined })); setNotice(null) }} />{invalid[key] && <p className="field-error" id={`acct-${key}-error`}>{t(invalid[key]!)}</p>}</div>)}
          <div className="account-email"><span className="small-label">{t('email')}</span><p>{snapshot.identity.email}</p><p className="field-hint">{t('acctEmailNote')}</p></div>
          <div className="field"><label htmlFor="acct-locale">{t('acctLocale')}</label><select id="acct-locale" disabled={disabled || conflict} value={profile.locale} onChange={event => { const value = event.target.value as 'en' | 'am'; setProfile({ ...profile, locale: value }); setLocale(value); setNotice(null) }}><option value="en">{t('english')}</option><option value="am">{t('amharic')}</option></select><p className="field-hint">{t('acctLocaleHint')}</p></div>
        </section><section className="account-photo"><RegistrationDocument rule={photoRule} value={profile.photo ?? undefined} disabled={disabled || conflict} service={service} onBusy={setUploading} onChange={photo => { setProfile(old => old && ({ ...old, photo: photo ?? null })); setNotice(null) }} onFailure={value => { if (['acctSignIn', 'acctDenied'].includes(errorKey(value))) failure(value) }} /><p className="field-hint">{t('acctPhotoHint')}</p></section>
      </div><div className="account-actions"><Button type="submit" className="primary" disabled={disabled || conflict || !profileDirty}>{t(busy === 'save' ? 'acctSaving' : 'acctSave')}</Button><Button className="secondary" disabled={disabled || !dirty} onClick={() => setDecision('discard')}>{t('acctDiscard')}</Button></div></form>
      <details className="application-card account-security"><summary>{t('acctSecurity')}</summary><p className="step-intro">{t('acctSecurityIntro')}</p><form onSubmit={event => void changePassword(event)} noValidate>
        {(Object.keys(passwordLabels) as PasswordField[]).map(key => <div className="field" key={key}><label htmlFor={`acct-${key}`}>{t(passwordLabels[key])}</label><div className="password-control"><input id={`acct-${key}`} type={show[key] ? 'text' : 'password'} autoComplete={key === 'currentPassword' ? 'current-password' : 'new-password'} required readOnly={disabled} value={passwords[key]} aria-invalid={!!invalid[key]} aria-describedby={invalid[key] ? `acct-${key}-error` : key === 'password' ? 'acct-password-hint' : undefined} onChange={event => { setPasswords(old => ({ ...old, [key]: event.target.value })); setInvalid(old => ({ ...old, [key]: undefined })) }} /><Button className="reveal" disabled={disabled} aria-label={t(key === 'currentPassword' ? show[key] ? 'acctHideCurrent' : 'acctShowCurrent' : key === 'password' ? show[key] ? 'resetHideNew' : 'resetShowNew' : show[key] ? 'resetHideConfirm' : 'resetShowConfirm')} aria-pressed={!!show[key]} onClick={() => setShow(old => ({ ...old, [key]: !old[key] }))}>{show[key] ? <EyeSlashIcon size={22} aria-hidden="true" /> : <EyeIcon size={22} aria-hidden="true" />}</Button></div>{invalid[key] && <p className="field-error" id={`acct-${key}-error`}>{t(invalid[key]!)}</p>}{key === 'password' && <p className="field-hint" id="acct-password-hint">{t('resetRequirements')}</p>}</div>)}
        <Button type="submit" className="primary" disabled={disabled}>{t(busy === 'password' ? 'acctPasswordSaving' : 'acctPasswordSave')}</Button>
      </form></details><p className="application-muted">{t('help')}</p>
    </>}
  </section>
}
