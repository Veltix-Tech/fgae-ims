import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { ArrowLeftIcon, ArrowRightIcon, CheckCircleIcon, ChatTextIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { correctionService as service } from '@correction-adapter'
import { authService } from '@auth-adapter'
import { Button } from '../../components/Button'
import { RegistrationDocument } from '../auth/RegistrationDocument'
import { useLocale } from '../../i18n/locale'
import type { TranslationKey } from '../../i18n/locales/en/auth'
import { CorrectionError, canCorrect, validateCorrection, type CorrectionContext, type CorrectionValues, type CorrectionReceipt, type CorrectionInput } from '../../services/contracts/corrections'
import { RegistrationError, emptyRegistration, todayDate, type PersonField } from '../../services/contracts/registration'
import { AuthError } from '../../services/contracts/auth'

const labels: Record<PersonField, TranslationKey> = { fullName: 'regFullName', email: 'email', phone: 'regPhone', birthDate: 'regBirthDate', gender: 'regGender', branchId: 'regBranch' }
const genders: Record<string, TranslationKey> = { FEMALE: 'regFemale', MALE: 'regMale', OTHER: 'regOther', UNDISCLOSED: 'regUndisclosed' }
const blank = (): CorrectionValues => ({ fields: { ...emptyRegistration }, documents: [] })
function message(failure: unknown): TranslationKey {
  const code = failure instanceof CorrectionError || failure instanceof AuthError || failure instanceof RegistrationError ? failure.code : 'UNAVAILABLE'
  return ({ SESSION_EXPIRED: 'appSignIn', FORBIDDEN: 'appDenied', NOT_RETURNED: 'corrNotReturned', REVISION_CONFLICT: 'corrConflict', DRAFT_CONFLICT: 'corrConflict', CONFIG_CHANGED: 'corrConfig', VALIDATION: 'corrValidation', DOCUMENT_MISSING: 'regDocumentMissing', FILE_TYPE: 'regFileType', FILE_SIZE: 'regFileSize', NETWORK: 'NETWORK', RATE_LIMITED: 'RATE_LIMITED', STORAGE_UNAVAILABLE: 'regStorage' } as Partial<Record<string, TranslationKey>>)[code] ?? 'corrUnavailable'
}
export function CorrectApplication() {
  const { t, locale } = useLocale()
  const [context, setContext] = useState<CorrectionContext | null>(null)
  const [values, setValues] = useState<CorrectionValues>(blank)
  const [saved, setSaved] = useState('')
  const [busy, setBusy] = useState<'load' | 'save' | 'submit' | null>('load')
  const [error, setError] = useState<TranslationKey | null>(null)
  const [notice, setNotice] = useState<TranslationKey | null>(null)
  const [invalid, setInvalid] = useState<Partial<Record<PersonField | 'confirmed', TranslationKey>>>({})
  const [uploads, setUploads] = useState<string[]>([])
  const [review, setReview] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [receipt, setReceipt] = useState<CorrectionReceipt | null>(null)
  const [decision, setDecision] = useState<'leave' | 'reload' | 'delete' | null>(null)
  const [attempt, setAttempt] = useState(0)
  const active = useRef<AbortController | null>(null)
  const inFlight = useRef(false)
  const allowLeave = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const feedback = useRef<HTMLDivElement>(null)
  const decisionHeading = useRef<HTMLHeadingElement>(null)
  const intent = useRef<{ payload: string; key: string } | null>(null)
  const dirty = !!context && !receipt && (JSON.stringify(values) !== saved || uploads.length > 0)
  const noBranches = !!context?.editableFields.includes('branchId') && !context.config.branches.length
  const conflict = error === 'corrConflict' || error === 'corrConfig'
  const disabled = !!busy || uploads.length > 0 || conflict || !!decision
  function fail(failure: unknown) {
    const key = message(failure); setError(key)
    if (key === 'appSignIn' || key === 'appDenied') { active.current?.abort(); inFlight.current = false; setBusy(null); setContext(null); setValues(blank()); setDecision(null); setUploads([]) }
    if (failure instanceof CorrectionError && Object.keys(failure.fields).length) { setInvalid(failure.fields as typeof invalid); setReview(false); requestAnimationFrame(() => document.getElementById(`corr-${Object.keys(failure.fields)[0]}`)?.focus()) }
  }
  useEffect(() => {
    const controller = new AbortController(); active.current = controller
    service.load(controller.signal).then(result => {
      if (controller.signal.aborted) return
      const restored = result.draft ? { fields: result.draft.fields, documents: result.draft.documents } : { fields: result.application.fields, documents: result.application.documents }
      setContext(result); setValues(restored); setSaved(JSON.stringify(restored)); setNotice(result.draft ? 'corrRestored' : null); setReview(false); setConfirmed(false); setInvalid({})
    }).catch(failure => { if (!controller.signal.aborted) setError(message(failure)) }).finally(() => { if (!controller.signal.aborted) setBusy(null) })
    return () => { controller.abort(); active.current?.abort() }
  }, [attempt])
  useEffect(() => {
    const invalidate = () => { active.current?.abort(); inFlight.current = false; setContext(null); setValues(blank()); setReceipt(null); setUploads([]); setBusy(null); setError('appSignIn'); setDecision(null) }
    const bus = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('fgae.auth') : null
    if (bus) bus.onmessage = invalidate
    return () => bus?.close()
  }, [])
  useEffect(() => {
    if (!context || receipt) return
    const controller = new AbortController(); let checking = false
    const verify = async () => {
      if (checking || inFlight.current || document.hidden) return
      checking = true
      try {
        const identity = await authService.restore(controller.signal)
        if (!controller.signal.aborted && (!identity || identity.id !== context.application.ownerId || !canCorrect(identity))) {
          active.current?.abort(); setContext(null); setValues(blank()); setUploads([]); setBusy(null); setDecision(null); setError('appSignIn')
        }
      } catch (failure) {
        if (!controller.signal.aborted && failure instanceof AuthError && failure.code === 'SESSION_EXPIRED') { active.current?.abort(); setContext(null); setValues(blank()); setBusy(null); setError('appSignIn') }
      } finally { checking = false }
    }
    const timer = window.setInterval(() => void verify(), 60_000); window.addEventListener('focus', verify)
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener('focus', verify) }
  }, [context, receipt])
  useEffect(() => { if (dirty) { const guard = (event: BeforeUnloadEvent) => { if (!allowLeave.current) { event.preventDefault(); event.returnValue = '' } }; window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard) } }, [dirty])
  useEffect(() => { if (error) { if (feedback.current) feedback.current.focus(); else heading.current?.focus() } }, [error])
  useEffect(() => { if (decision) decisionHeading.current?.focus() }, [decision])
  useEffect(() => { if (!busy && !error) heading.current?.focus() }, [busy, error, review, receipt])
  function input(): CorrectionInput { return { ...values, applicationId: context!.application.id, revision: context!.revision, draftVersion: context!.draftVersion, configVersion: context!.config.version } }
  function change(key: PersonField, value: string) { setValues(old => ({ ...old, fields: { ...old.fields, [key]: value } })); setInvalid(old => ({ ...old, [key]: undefined })); setNotice(null); setConfirmed(false) }
  function leave(event: MouseEvent<HTMLAnchorElement>) { if (dirty && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.button === 0) { event.preventDefault(); setDecision('leave') } }
  async function save() {
    if (disabled || inFlight.current || !context) return
    const controller = new AbortController(); active.current = controller; inFlight.current = true; setBusy('save'); setError(null)
    try {
      const result = await service.save(input(), controller.signal)
      if (!controller.signal.aborted) { setContext(old => old && ({ ...old, draftVersion: result.version, draft: result })); setSaved(JSON.stringify(values)); setNotice('corrSaved') }
    } catch (failure) { if (!controller.signal.aborted) fail(failure) }
    finally { if (!controller.signal.aborted) { setBusy(null); inFlight.current = false } }
  }
  async function next(event: FormEvent) {
    event.preventDefault()
    if (disabled || inFlight.current || !context) return
    setError(null); setNotice(null); setInvalid({})
    const body = { ...input(), confirmed: true, idempotencyKey: 'validation' }
    try { validateCorrection(body, context, true) } catch (failure) { fail(failure); return }
    if (!review) { setReview(true); return }
    if (!confirmed) { setInvalid({ confirmed: 'regConfirmRequired' }); document.getElementById('corr-confirmed')?.focus(); return }
    const payload = JSON.stringify({ ...body, idempotencyKey: undefined })
    if (intent.current?.payload !== payload) intent.current = { payload, key: crypto.randomUUID() }
    const controller = new AbortController(); active.current = controller; inFlight.current = true; setBusy('submit')
    try {
      const result = await service.submit({ ...body, idempotencyKey: intent.current.key }, controller.signal)
      if (!controller.signal.aborted) { setReceipt(result); setValues(blank()); setSaved(''); setContext(null); intent.current = null }
    } catch (failure) { if (!controller.signal.aborted) fail(failure) }
    finally { if (!controller.signal.aborted) { setBusy(null); inFlight.current = false } }
  }
  async function decide() {
    if (decision === 'leave') { allowLeave.current = true; active.current?.abort(); window.location.assign('/my-application'); return }
    if (decision === 'reload') { setDecision(null); setContext(null); setValues(blank()); setError(null); setBusy('load'); setAttempt(old => old + 1); return }
    if (decision !== 'delete' || !context || inFlight.current) return
    const controller = new AbortController(); active.current = controller; inFlight.current = true; setBusy('save'); setError(null)
    try {
      const result = await service.discard(input(), controller.signal)
      if (!controller.signal.aborted) {
        const restored = { fields: context.application.fields, documents: context.application.documents }
        setContext({ ...context, draft: null, draftVersion: result.draftVersion }); setValues(restored); setSaved(JSON.stringify(restored)); setConfirmed(false); setReview(false); setDecision(null); setNotice('corrDraftDeleted')
      }
    } catch (failure) { if (!controller.signal.aborted) { setDecision(null); fail(failure) } }
    finally { if (!controller.signal.aborted) { setBusy(null); inFlight.current = false } }
  }
  const format = (key: PersonField, value: string) => !value ? t('appNoValue') : key === 'gender' ? t(genders[value] ?? 'appNoValue') : key === 'branchId' ? context?.config.branches.find(branch => branch.id === value)?.name ?? value : key === 'birthDate' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', calendar: 'gregory', timeZone: 'UTC' }).format(new Date(value)) : value
  const gate = error === 'appSignIn' || error === 'appDenied' || error === 'corrNotReturned'
  return <section className="correction-page motion-enter" aria-labelledby="correction-heading" aria-busy={!!busy}>
    <a href="/my-application" onClick={leave} className="text-link back-link"><ArrowLeftIcon size={18} aria-hidden="true" />{t('corrBack')}</a>
    <p className="eyebrow">{t('appEyebrow')}</p><h1 id="correction-heading" ref={heading} tabIndex={-1}>{t(receipt ? 'corrSuccess' : gate ? error : review ? 'corrReview' : 'corrHeading')}</h1>
    <p className="form-subtitle">{t(receipt ? 'corrSuccessBody' : error === 'corrNotReturned' ? 'corrNotReturnedBody' : error === 'appSignIn' ? 'appSignInNote' : error === 'appDenied' ? 'appDeniedNote' : review ? 'corrReviewIntro' : 'corrIntro')}</p>
    {error && !gate && <div className="feedback error" role="alert" tabIndex={-1} ref={feedback}><WarningCircleIcon size={22} aria-hidden="true" /><div><strong>{t('regErrorTitle')}</strong><p>{t(error)}</p>{conflict && <Button className="text-button" disabled={!!busy || uploads.length > 0} onClick={() => setDecision('reload')}>{t('corrReload')}</Button>}</div></div>}
    {notice && !gate && <p className="registration-notice" role="status">{t(notice)}</p>}
    {decision && <section className="leave-confirmation" aria-labelledby="corr-decision"><h2 id="corr-decision" ref={decisionHeading} tabIndex={-1}>{t(decision === 'delete' ? 'corrDelete' : decision === 'reload' ? 'corrReloadHeading' : 'regLeaveHeading')}</h2><p>{t(decision === 'delete' ? 'corrDeleteBody' : decision === 'reload' ? 'corrReloadBody' : 'corrLeaveBody')}</p><div className="leave-actions"><Button className="secondary" disabled={!!busy} onClick={() => { setDecision(null); heading.current?.focus() }}>{t('resetKeepEditing')}</Button><Button className="secondary" disabled={!!busy} onClick={() => void decide()}>{t(decision === 'delete' ? 'corrDeleteAction' : decision === 'reload' ? 'corrReload' : 'regLeaveConfirm')}</Button></div></section>}
    {busy === 'load' ? <p className="session-check" role="status"><span className="spinner" aria-hidden="true" />{t('corrLoading')}</p> : receipt ? <div className="application-state motion-enter"><CheckCircleIcon size={36} aria-hidden="true" /><dl className="registration-summary"><div><dt>{t('appReference')}</dt><dd>{receipt.id}</dd></div><div><dt>{t('corrSent')}</dt><dd>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', calendar: 'gregory', timeZone: 'Africa/Addis_Ababa' }).format(new Date(receipt.resubmittedAt))}</dd></div></dl><a href="/my-application" className="primary action-link">{t('appLink')}</a></div> : gate ? <a href={error === 'appSignIn' || error === 'appDenied' ? '/sign-in' : '/my-application'} className="primary action-link correction-gate">{t(error === 'appSignIn' ? 'signIn' : error === 'appDenied' ? 'appAccount' : 'appLink')}</a> : !context ? <Button className="primary correction-gate" onClick={() => { setError(null); setBusy('load'); setAttempt(old => old + 1) }}>{t('appRetry')}</Button> : <div className="correction-columns">
      <aside className="correction-guidance"><div className="application-card correction-feedback"><ChatTextIcon size={26} aria-hidden="true" /><h2>{t('corrFeedback')}</h2><p className="decision-note">{context.application.history.filter(event => event.status === 'RETURNED').at(-1)?.note}</p><p className="application-muted">{t('corrReviewNote')}</p></div><dl className="application-details correction-identity"><div><dt>{t('regFullName')}</dt><dd>{context.application.fields.fullName}</dd></div><div><dt>{t('email')}</dt><dd>{context.application.fields.email}</dd></div><div><dt>{t('appReference')}</dt><dd>{context.application.id}</dd></div></dl><p className="application-muted">{t('corrLocked')}</p></aside>
      <div>{noBranches && <div className="registration-notice" role="status"><p>{t('regEmptyBranches')}</p><Button className="text-button" disabled={!!busy || uploads.length > 0} onClick={() => setDecision('reload')}>{t('corrReload')}</Button></div>}<form onSubmit={event => void next(event)} noValidate>
        <div key={review ? 'review' : 'edit'} className="motion-enter">
          {!review ? <><section className="application-card correction-fields" aria-labelledby="corr-details"><h2 id="corr-details">{t('corrDetails')}</h2>{!context.editableFields.length && <p>{t('corrNoFields')}</p>}{context.editableFields.map(key => {
            const attrs = { id: `corr-${key}`, value: values.fields[key], disabled, required: context.config.requiredFields.includes(key), 'aria-invalid': !!invalid[key], 'aria-describedby': invalid[key] ? `corr-${key}-error` : undefined, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => change(key, event.target.value) }
            return <div className="field" key={key}><label htmlFor={`corr-${key}`}>{t(labels[key])}{!context.config.requiredFields.includes(key) && <span className="optional-label"> {t('regOptional')}</span>}</label>{key === 'branchId' || key === 'gender' ? <select {...attrs}><option value="">{t('regSelect')}</option>{key === 'branchId' ? context.config.branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>) : Object.entries(genders).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select> : <input {...attrs} type={key === 'birthDate' ? 'date' : key === 'phone' ? 'tel' : 'text'} max={key === 'birthDate' ? todayDate() : undefined} maxLength={key === 'fullName' ? 150 : undefined} />}{invalid[key] && <p className="field-error" id={`corr-${key}-error`}>{t(invalid[key]!)}</p>}{key === 'phone' && <p className="field-hint">{t('regPhoneHint')}</p>}</div>
          })}</section><section className="correction-documents" aria-labelledby="corr-documents"><h2 id="corr-documents">{t('corrDocuments')}</h2>{!context.documentTypes.length && <p>{t('corrNoDocuments')}</p>}{context.config.documents.filter(rule => context.documentTypes.includes(rule.id)).map(rule => <RegistrationDocument key={rule.id} rule={rule} value={values.documents.find(doc => doc.typeId === rule.id)} disabled={!!busy || conflict || !!decision} service={service} onFailure={failure => { if (['appSignIn', 'appDenied', 'corrNotReturned', 'corrConflict', 'corrConfig'].includes(message(failure))) fail(failure) }} onChange={doc => { setValues(old => ({ ...old, documents: [...old.documents.filter(item => item.typeId !== rule.id), ...(doc ? [doc] : [])] })); setConfirmed(false); setNotice(null) }} onBusy={uploading => setUploads(old => uploading ? [...new Set([...old, rule.id])] : old.filter(id => id !== rule.id))} />)}</section></> : <section className="application-card correction-review"><h2>{t('corrReview')}</h2>{context.editableFields.map(key => <div className="correction-comparison" key={key}><h3>{t(labels[key])}</h3><dl><div><dt>{t('corrCurrent')}</dt><dd>{format(key, context.application.fields[key])}</dd></div><div><dt>{t('corrNew')}</dt><dd>{format(key, values.fields[key])}{values.fields[key] === context.application.fields[key] && <small> · {t('corrUnchanged')}</small>}</dd></div></dl></div>)}<h3>{t('corrDocuments')}</h3><ul className="review-files">{context.documentTypes.map(typeId => { const doc = values.documents.find(item => item.typeId === typeId); const original = context.application.documents.find(item => item.typeId === typeId); return <li key={typeId}>{context.config.documents.find(rule => rule.id === typeId)?.label[locale]}: {doc?.name ?? t('appNoValue')} <span>({t(doc?.id === original?.id ? 'corrUnchanged' : !doc ? 'corrRemoved' : 'corrAdded')})</span></li> })}</ul><label className="registration-confirm"><input id="corr-confirmed" type="checkbox" checked={confirmed} disabled={disabled} aria-invalid={!!invalid.confirmed} aria-describedby={invalid.confirmed ? 'corr-confirmed-error' : undefined} onChange={event => { setConfirmed(event.target.checked); setInvalid({}) }} /><span>{t('regConfirm')}</span></label>{invalid.confirmed && <p id="corr-confirmed-error" className="field-error">{t(invalid.confirmed)}</p>}</section>}
        </div><div className="registration-navigation">{review && <Button className="secondary" disabled={disabled} onClick={() => { setReview(false); setConfirmed(false) }}>{t('regEdit')}</Button>}<Button className="primary" type="submit" disabled={disabled || noBranches}>{t(busy === 'submit' ? 'corrSubmitting' : review ? 'corrSubmit' : 'corrReviewButton')}{busy === 'submit' ? <span className="spinner" aria-hidden="true" /> : <ArrowRightIcon size={19} aria-hidden="true" />}</Button></div>
      </form><div className="draft-actions"><Button className="text-button" disabled={disabled} onClick={() => void save()}>{t(busy === 'save' ? 'regSaving' : 'regSaveDraft')}</Button>{context.draft && <Button className="text-button" disabled={disabled} onClick={() => setDecision('delete')}>{t('regDiscardDraft')}</Button>}</div><p className="field-hint">{t('corrDraftHint')}</p></div>
    </div>}
  </section>
}
