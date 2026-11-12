import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { ArrowLeftIcon, ArrowRightIcon, CheckCircleIcon, EyeIcon, EyeSlashIcon, UserPlusIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { registrationService as service } from '@registration-adapter'
import { Button } from '../../components/Button'
import { useLocale } from '../../i18n/locale'
import type { TranslationKey } from '../../i18n/locales/en/auth'
import { emptyRegistration, personalErrors, todayDate, RegistrationError, type RegistrationFields, type RegistrationConfig, type RegistrationDocument as Document, type RegistrationReceipt, type PersonField } from '../../services/contracts/registration'
import { validNewPassword } from '../../services/contracts/reset-password'
import { RegistrationDocument } from './RegistrationDocument'

const steps: TranslationKey[] = ['regDetails', 'regAccount', 'regDocuments', 'regReview']
const introductions: TranslationKey[] = ['regDetailsIntro', 'regAccountIntro', 'regDocumentsIntro', 'regReviewIntro']
const labels: Record<PersonField, TranslationKey> = { fullName: 'regFullName', email: 'email', phone: 'regPhone', birthDate: 'regBirthDate', gender: 'regGender', branchId: 'regBranch' }
const genders: Record<string, TranslationKey> = { FEMALE: 'regFemale', MALE: 'regMale', OTHER: 'regOther', UNDISCLOSED: 'regUndisclosed' }
function errorMessage(failure: unknown): TranslationKey {
  if (!(failure instanceof RegistrationError)) return 'regUnavailable'
  return ({ NETWORK: 'NETWORK', RATE_LIMITED: 'RATE_LIMITED', STORAGE_UNAVAILABLE: 'regStorage', EMAIL_IN_USE: 'regEmailUsed', VALIDATION: 'regValidation', CONFIG_CHANGED: 'regConfigChanged', DRAFT_CONFLICT: 'regConflict', DOCUMENT_MISSING: 'regDocumentMissing', FILE_TYPE: 'regFileType', FILE_SIZE: 'regFileSize' } as Partial<Record<string, TranslationKey>>)[failure.code] ?? 'regUnavailable'
}
export function Register() {
  const { t, locale } = useLocale()
  const [config, setConfig] = useState<RegistrationConfig | null>(null)
  const [fields, setFields] = useState<RegistrationFields>({ ...emptyRegistration })
  const [documents, setDocuments] = useState<Document[]>([])
  const [step, setStep] = useState(0)
  const [version, setVersion] = useState(0)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [show, setShow] = useState({ password: false, confirmation: false })
  const [confirmed, setConfirmed] = useState(false)
  const [receipt, setReceipt] = useState<RegistrationReceipt | null>(() => service.receipt())
  const [busy, setBusy] = useState<'load' | 'save' | 'submit' | null>('load')
  const [uploads, setUploads] = useState<string[]>([])
  const [error, setError] = useState<TranslationKey | null>(null)
  const [notice, setNotice] = useState<TranslationKey | null>(null)
  const [invalid, setInvalid] = useState<Partial<Record<PersonField | 'password' | 'confirmation' | 'confirmed', TranslationKey>>>({})
  const [decision, setDecision] = useState<'leave' | 'delete' | 'reload' | null>(null)
  const [saved, setSaved] = useState(JSON.stringify({ fields: emptyRegistration, documents: [] }))
  const [attempt, setAttempt] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)
  const summary = useRef<HTMLDivElement>(null)
  const decisionHeading = useRef<HTMLHeadingElement>(null)
  const active = useRef<AbortController | null>(null)
  const intent = useRef<{ payload: string; key: string } | null>(null)
  const inFlight = useRef(false)
  const allowLeave = useRef(false)
  const dirty = !receipt && (JSON.stringify({ fields, documents }) !== saved || !!password || !!confirmation || uploads.length > 0)
  const disabled = !!busy || uploads.length > 0

  useEffect(() => {
    const controller = new AbortController(); active.current = controller
    Promise.all([service.config(controller.signal), service.draft(controller.signal)]).then(([settings, draft]) => {
      if (controller.signal.aborted) return
      setConfig(settings)
      const restored = draft?.fields ?? { ...emptyRegistration }; const files = (draft?.documents ?? []).filter(doc => settings.documents.some(rule => rule.id === doc.typeId && rule.types.includes(doc.mime) && doc.size <= rule.maxBytes))
      setFields(restored); setDocuments(files); setStep(draft?.step ?? 0); setVersion(draft?.version ?? 0)
      setSaved(JSON.stringify({ fields: restored, documents: files })); setPassword(''); setConfirmation(''); setConfirmed(false)
      if (draft) setNotice('regRestored')
    }).catch(failure => { if (!controller.signal.aborted) setError(errorMessage(failure)) })
      .finally(() => { if (!controller.signal.aborted) setBusy(null) })
    return () => { controller.abort(); active.current?.abort() }
  }, [attempt])
  useEffect(() => { if (!busy && !error) heading.current?.focus() }, [step, receipt, busy, error])
  useEffect(() => { if (error) summary.current?.focus() }, [error])
  useEffect(() => { if (decision) decisionHeading.current?.focus() }, [decision])
  useEffect(() => {
    if (!dirty) return
    const guard = (event: BeforeUnloadEvent) => { if (!allowLeave.current) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [dirty])
  function change(key: PersonField, value: string) { setFields(old => ({ ...old, [key]: value })); setInvalid(old => ({ ...old, [key]: undefined })); setNotice(null); setConfirmed(false) }
  function go(next: number) { setStep(next); setError(null); setInvalid({}); setNotice(null) }
  function focus(id: string) { requestAnimationFrame(() => document.getElementById(id)?.focus()) }
  function validate(index: number) {
    if (!config) return false
    if (index === 0) {
      const errors = personalErrors(fields, config) as Partial<Record<PersonField, TranslationKey>>
      setInvalid(errors)
      const key = Object.keys(errors)[0]
      if (key) { setStep(0); focus(`reg-${key}`); return false }
    }
    if (index === 1) {
      const errors = { password: !password ? 'passwordRequired' : !validNewPassword(password) ? 'resetLength' : undefined, confirmation: !confirmation ? 'resetConfirmRequired' : password !== confirmation ? 'resetMismatch' : undefined } as typeof invalid
      setInvalid(errors)
      if (errors.password || errors.confirmation) { setStep(1); focus(errors.password ? 'reg-password' : 'reg-confirmation'); return false }
    }
    if (index === 2 && config.documents.some(rule => rule.required && !documents.some(doc => doc.typeId === rule.id))) { setStep(2); setError('regMissingDocument'); requestAnimationFrame(() => summary.current?.focus()); return false }
    return true
  }
  async function next(event: FormEvent) {
    event.preventDefault()
    if (disabled || inFlight.current || !config) return
    setError(null); setNotice(null)
    if (step < 3) { if (validate(step)) go(step + 1); return }
    if (![0, 1, 2].every(validate)) return
    if (!confirmed) { setInvalid({ confirmed: 'regConfirmRequired' }); focus('reg-confirmed'); return }
    const input = { fields, documents, password, confirmation, confirmed, configVersion: config.version }
    const payload = JSON.stringify(input)
    if (intent.current?.payload !== payload) intent.current = { payload, key: crypto.randomUUID() }
    const controller = new AbortController(); active.current = controller; inFlight.current = true; setBusy('submit')
    try {
      const result = await service.submit({ ...input, idempotencyKey: intent.current.key }, controller.signal)
      if (controller.signal.aborted) return
      setReceipt(result); setPassword(''); setConfirmation(''); intent.current = null
      if (version) {
        try { await service.clearDraft(version, controller.signal); setVersion(0) }
        catch { if (!controller.signal.aborted) setNotice('regDraftCleanup') }
      }
    } catch (failure) {
      if (controller.signal.aborted) return
      setError(errorMessage(failure)); requestAnimationFrame(() => summary.current?.focus())
      if (failure instanceof RegistrationError && failure.code === 'EMAIL_IN_USE') { setStep(0); setInvalid({ email: 'regEmailUsed' }); focus('reg-email') }
      else if (failure instanceof RegistrationError && Object.keys(failure.fields).length) { setStep(0); setInvalid(failure.fields as typeof invalid); focus(`reg-${Object.keys(failure.fields)[0]}`) }
    } finally { if (!controller.signal.aborted) { inFlight.current = false; setBusy(null) } }
  }
  async function save() {
    if (disabled || inFlight.current) return
    const controller = new AbortController(); active.current = controller; inFlight.current = true; setBusy('save'); setError(null)
    try {
      const result = await service.saveDraft({ fields, documents, step, version }, controller.signal)
      if (!controller.signal.aborted) { setVersion(result.version); setSaved(JSON.stringify({ fields, documents })); setNotice('regSaved') }
    } catch (failure) { if (!controller.signal.aborted) setError(errorMessage(failure)) }
    finally { if (!controller.signal.aborted) { inFlight.current = false; setBusy(null) } }
  }
  async function decide() {
    if (decision === 'leave') { allowLeave.current = true; active.current?.abort(); window.location.assign('/sign-in'); return }
    if (decision === 'reload') { setDecision(null); setError(null); setBusy('load'); setAttempt(old => old + 1); return }
    if (decision !== 'delete' || inFlight.current) return
    inFlight.current = true; setBusy('save'); setError(null)
    try {
      await service.clearDraft(version)
      setFields({ ...emptyRegistration }); setDocuments([]); setVersion(0); setPassword(''); setConfirmation(''); setConfirmed(false); setStep(0)
      setSaved(JSON.stringify({ fields: emptyRegistration, documents: [] })); setNotice(null); setDecision(null)
    } catch (failure) { setError(errorMessage(failure)) }
    finally { inFlight.current = false; setBusy(null) }
  }
  function leave(event: MouseEvent<HTMLAnchorElement>) { if (dirty && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.button === 0) { event.preventDefault(); setDecision('leave') } }
  async function refreshConfig() {
    if (disabled) return
    setBusy('load'); setError(null)
    try {
      const settings = await service.config(); setConfig(settings)
      setDocuments(old => old.filter(doc => settings.documents.some(rule => rule.id === doc.typeId && rule.types.includes(doc.mime) && doc.size <= rule.maxBytes)))
      setConfirmed(false); setStep(0)
    } catch (failure) { setError(errorMessage(failure)) } finally { setBusy(null) }
  }
  const label = (key: PersonField) => <label htmlFor={`reg-${key}`}>{t(labels[key])}{config && !config.requiredFields.includes(key) && key !== 'email' && <span className="optional-label"> {t('regOptional')}</span>}</label>
  const fieldError = (key: PersonField | 'password' | 'confirmation') => invalid[key] && <p className="field-error" id={`reg-${key}-error`}>{t(invalid[key]!)}</p>
  const attrs = (key: PersonField) => ({ id: `reg-${key}`, name: key, value: fields[key], required: key === 'email' || config?.requiredFields.includes(key), disabled, 'aria-invalid': !!invalid[key], 'aria-describedby': invalid[key] ? `reg-${key}-error` : key === 'phone' ? 'reg-phone-hint' : undefined })
  return <section className="sign-in recovery registration" aria-labelledby="register-heading">
    {!receipt && <a className="text-link back-link" href="/sign-in" onClick={leave}><ArrowLeftIcon size={17} aria-hidden="true" />{t('recoveryBack')}</a>}
    <div className="recovery-icon" aria-hidden="true">{receipt ? <CheckCircleIcon size={29} /> : <UserPlusIcon size={29} />}</div>
    <p className="eyebrow form-eyebrow">{t('regEyebrow')}</p>
    <h1 id="register-heading" ref={heading} tabIndex={-1}>{t(receipt ? 'regSuccessHeading' : 'regHeading')}</h1>
    <p className="form-subtitle">{t(receipt ? 'regSuccessIntro' : 'regIntro')}</p>
    {error && <div className="feedback error" ref={summary} role="alert" tabIndex={-1}><WarningCircleIcon size={22} aria-hidden="true" /><div><strong>{t('regErrorTitle')}</strong><p>{t(error)}</p>
      {error === 'regConflict' && <Button className="text-button" disabled={disabled} onClick={() => setDecision('reload')}>{t('regReload')}</Button>}
      {error === 'regConfigChanged' && <Button className="text-button" disabled={disabled} onClick={() => void refreshConfig()}>{t('regRefreshConfig')}</Button>}
    </div></div>}
    {notice && <p className="registration-notice" role="status">{t(notice)}</p>}
    {decision && <section className="leave-confirmation" aria-labelledby="reg-decision">
      <h2 id="reg-decision" ref={decisionHeading} tabIndex={-1}>{t(decision === 'leave' ? 'regLeaveHeading' : decision === 'delete' ? 'regDeleteHeading' : 'regReloadHeading')}</h2>
      <p>{t(decision === 'leave' ? 'regLeaveBody' : decision === 'delete' ? 'regDeleteBody' : 'regReloadBody')}</p>
      <div className="leave-actions"><Button className="secondary" disabled={disabled} onClick={() => { setDecision(null); heading.current?.focus() }}>{t('resetKeepEditing')}</Button><Button className="secondary" disabled={disabled} onClick={() => void decide()}>{t(decision === 'leave' ? 'regLeaveConfirm' : decision === 'delete' ? 'regDeleteConfirm' : 'regReload')}</Button></div>
    </section>}
    {receipt ? <div className="success-content"><span className="status-pill">{t('regPending')}</span><dl className="registration-summary"><div><dt>{t('regReference')}</dt><dd>{receipt.id}</dd></div><div><dt>{t('email')}</dt><dd>{receipt.email}</dd></div><div><dt>{t('regSubmittedAt')}</dt><dd>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'Africa/Addis_Ababa' }).format(new Date(receipt.submittedAt))}</dd></div></dl>
      <a href="/sign-in" className="primary action-link">{t('resetSignIn')}<ArrowRightIcon size={20} aria-hidden="true" /></a>
      <Button className="secondary recovery-change" disabled={disabled} onClick={() => { try { service.clearReceipt(); setReceipt(null); setNotice(null); setError(null); setBusy('load'); setAttempt(old => old + 1) } catch { setError('regStorage') } }}>{t('regAnother')}</Button>
    </div> : busy === 'load' ? <p role="status" className="session-check"><span className="spinner" aria-hidden="true" />{t('regLoading')}</p> : !config ? <Button className="primary" onClick={() => { setError(null); setBusy('load'); setAttempt(old => old + 1) }}>{t('resetRetry')}</Button> : !config.branches.length ? <div><p className="registration-notice">{t('regEmptyBranches')}</p><Button className="secondary" onClick={() => void refreshConfig()}>{t('resetRetry')}</Button></div> : <>
      <nav aria-label={t('regStep').replace('{step}', String(step + 1))}><ol className="registration-steps">{steps.map((key, index) => <li key={key}><Button className="step-button" aria-current={step === index ? 'step' : undefined} disabled={disabled || index >= step} onClick={() => go(index)}><span aria-hidden="true">{index + 1}</span>{t(key)}</Button></li>)}</ol></nav>
      <form onSubmit={event => void next(event)} noValidate aria-busy={!!busy}>
        <div key={step} className="registration-step motion-enter"><p className="eyebrow">{t('regStep').replace('{step}', String(step + 1))}</p><h2>{t(steps[step]!)}</h2><p className="step-intro">{t(introductions[step]!)}</p>
          {step === 0 && <div className="registration-fields">
            <div className="field span-two">{label('fullName')}<input {...attrs('fullName')} autoComplete="name" maxLength={150} onChange={event => change('fullName', event.target.value)} />{fieldError('fullName')}</div>
            <div className="field span-two">{label('email')}<input {...attrs('email')} type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} onChange={event => change('email', event.target.value)} />{fieldError('email')}</div>
            <div className="field span-two">{label('phone')}<input {...attrs('phone')} type="tel" autoComplete="tel" onChange={event => change('phone', event.target.value)} />{fieldError('phone')}<p className="field-hint" id="reg-phone-hint">{t('regPhoneHint')}</p></div>
            <div className="field">{label('birthDate')}<input {...attrs('birthDate')} type="date" autoComplete="bday" max={todayDate()} onChange={event => change('birthDate', event.target.value)} />{fieldError('birthDate')}</div>
            <div className="field">{label('gender')}<select {...attrs('gender')} onChange={event => change('gender', event.target.value)}><option value="">{t('regSelect')}</option>{Object.entries(genders).map(([value, key]) => <option value={value} key={value}>{t(key)}</option>)}</select>{fieldError('gender')}</div>
            <div className="field span-two">{label('branchId')}<select {...attrs('branchId')} onChange={event => change('branchId', event.target.value)}><option value="">{t('regSelect')}</option>{config.branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>{fieldError('branchId')}</div>
          </div>}
          {step === 1 && <><p className="registration-notice">{fields.email}</p>{(['password', 'confirmation'] as const).map(key => <div className="field" key={key}><label htmlFor={`reg-${key}`}>{t(key === 'password' ? 'resetNew' : 'resetConfirm')}</label><div className="password-control"><input id={`reg-${key}`} type={show[key] ? 'text' : 'password'} autoComplete="new-password" required readOnly={disabled} value={key === 'password' ? password : confirmation} aria-invalid={!!invalid[key]} aria-describedby={invalid[key] ? `reg-${key}-error` : key === 'password' ? 'reg-password-hint' : undefined} onChange={event => { if (key === 'password') setPassword(event.target.value); else setConfirmation(event.target.value); setInvalid(old => ({ ...old, [key]: undefined })); setConfirmed(false) }} /><Button className="reveal" aria-label={t(key === 'password' ? show[key] ? 'resetHideNew' : 'resetShowNew' : show[key] ? 'resetHideConfirm' : 'resetShowConfirm')} aria-pressed={show[key]} onClick={() => setShow(old => ({ ...old, [key]: !old[key] }))}>{show[key] ? <EyeSlashIcon size={22} aria-hidden="true" /> : <EyeIcon size={22} aria-hidden="true" />}</Button></div>{fieldError(key)}{key === 'password' && <p className="field-hint" id="reg-password-hint">{t('resetRequirements')}</p>}</div>)}</>}
          {step === 2 && <>{!config.documents.length && <p>{t('regNoDocuments')}</p>}{config.documents.map(rule => <RegistrationDocument key={rule.id} rule={rule} value={documents.find(doc => doc.typeId === rule.id)} disabled={!!busy} onChange={value => { setDocuments(old => [...old.filter(doc => doc.typeId !== rule.id), ...(value ? [value] : [])]); setConfirmed(false); setError(null) }} onBusy={uploading => setUploads(old => uploading ? [...new Set([...old, rule.id])] : old.filter(id => id !== rule.id))} />)}</>}
          {step === 3 && <><div className="review-heading"><h3>{t('regDetails')}</h3><Button className="text-button" disabled={disabled} onClick={() => go(0)}>{t('regEdit')}</Button></div><dl className="registration-summary">{(Object.keys(labels) as PersonField[]).map(key => <div key={key}><dt>{t(labels[key])}</dt><dd>{key === 'gender' ? fields.gender ? t(genders[fields.gender]!) : '—' : key === 'branchId' ? config.branches.find(branch => branch.id === fields.branchId)?.name : key === 'birthDate' && fields.birthDate && Number.isFinite(Date.parse(fields.birthDate + 'T00:00:00Z')) ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', calendar: 'gregory', timeZone: 'UTC' }).format(new Date(fields.birthDate + 'T00:00:00Z')) : fields[key] || '—'}</dd></div>)}</dl>
            <div className="review-heading"><h3>{t('regAccount')}</h3><Button className="text-button" disabled={disabled} onClick={() => go(1)}>{t('regEdit')}</Button></div><p className="step-intro">{t(password ? 'regPasswordSet' : 'regNoPassword')}</p>
            <div className="review-heading"><h3>{t('regDocuments')}</h3><Button className="text-button" disabled={disabled} onClick={() => go(2)}>{t('regEdit')}</Button></div><ul className="review-files">{documents.map(doc => <li key={doc.id}>{doc.name}</li>)}</ul>
            <label className="registration-confirm"><input id="reg-confirmed" type="checkbox" checked={confirmed} disabled={disabled} aria-invalid={!!invalid.confirmed} aria-describedby={invalid.confirmed ? 'reg-confirmed-error' : undefined} onChange={event => { setConfirmed(event.target.checked); setInvalid({}) }} /><span>{t('regConfirm')}</span></label>{invalid.confirmed && <p id="reg-confirmed-error" className="field-error">{t(invalid.confirmed)}</p>}
          </>}
        </div>
        <div className="registration-navigation">{step > 0 && <Button className="secondary" disabled={disabled} onClick={() => go(step - 1)}><ArrowLeftIcon size={18} aria-hidden="true" />{t('regBack')}</Button>}<Button className="primary" type="submit" disabled={disabled}>{t(busy === 'submit' ? 'regSubmitting' : step === 3 ? 'regSubmit' : 'regNext')}{busy === 'submit' ? <span className="spinner" aria-hidden="true" /> : <ArrowRightIcon size={20} aria-hidden="true" />}</Button></div>
      </form>
      <div className="draft-actions"><Button className="text-button" disabled={disabled} onClick={() => void save()}>{t(busy === 'save' ? 'regSaving' : 'regSaveDraft')}</Button>{version > 0 && <Button className="text-button" disabled={disabled} onClick={() => setDecision('delete')}>{t('regDiscardDraft')}</Button>}</div><p className="field-hint">{t('regDraftHint')}</p>
    </>}
  </section>
}
