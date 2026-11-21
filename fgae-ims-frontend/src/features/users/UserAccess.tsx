import { authService } from '@auth-adapter'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { accessService } from '@user-access-adapter'
import { Button } from '../../components/Button'
import { Accordion, AccordionSelect } from '../../components/Accordion'
import { AnimatedResults } from '../../components/AnimatedResults'
import { useLocale } from '../../i18n/locale'
import type { TranslationKey } from '../../i18n/locales/en/auth'
import { roles, type Identity, type Role } from '../../services/contracts/auth'
import { AccessError, canAdminUsers, validateAccess, type AccessContext, type AccessInput, type AccessResult } from '../../services/contracts/user-access'
import type { DirectoryUser } from '../../services/contracts/portfolio'
const states = { ACTIVE: 'accessActive', PENDING: 'accessPending', SUSPENDED: 'accessSuspended', INACTIVE: 'accessInactive' } as const
const errors: Record<string, TranslationKey> = { FORBIDDEN: 'mgrDeniedNote', SESSION_EXPIRED: 'homeSignInNote', NETWORK: 'NETWORK', RATE_LIMITED: 'RATE_LIMITED', STORAGE_UNAVAILABLE: 'STORAGE_UNAVAILABLE', CONFLICT: 'uaConflict', EMAIL_IN_USE: 'uaEmailUsed', LAST_ADMIN: 'uaLastAdmin', NOT_FOUND: 'uaNotFound', SELF_RESET: 'uaSelfReset', VALIDATION: 'uaValidation' }
const blank: AccessInput = { version: 0, name: '', email: '', state: 'ACTIVE', grants: [], reason: '', reset: false, idempotencyKey: '' }
export function UserAccess({ mode, userId }: { mode: 'create' | 'detail' | 'edit'; userId?: string }) {
  const { t, locale } = useLocale()
  const [context, setContext] = useState<AccessContext | null>(null); const [identity, setIdentity] = useState<Identity | null>(null)
  const [form, setForm] = useState<AccessInput>(blank); const [initial, setInitial] = useState(''); const [busy, setBusy] = useState(true); const [error, setError] = useState<TranslationKey | null>(null)
  const [review, setReview] = useState(false); const [confirmed, setConfirmed] = useState(false); const [result, setResult] = useState<AccessResult | null>(null); const [revealed, setRevealed] = useState(false); const [notice, setNotice] = useState<TranslationKey | null>(null)
  const heading = useRef<HTMLHeadingElement>(null); const feedback = useRef<HTMLDivElement>(null); const request = useRef<AbortController | null>(null); const flight = useRef(false); const invalidated = useRef(false)
  const allowLeave = useRef(false)
  const operation = useRef<{ payload: string; key: string } | null>(null)
  const dirty = mode !== 'detail' && !result && !!context && JSON.stringify(form) !== initial
  const load = useCallback(async () => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller; setBusy(true); setContext(null); setError(null); setResult(null)
    try {
      const loaded = await accessService.load(userId, controller.signal); if (controller.signal.aborted) return
      const user = loaded.context.record?.user
      const next: AccessInput = user ? { id: user.id, version: loaded.context.record!.version, name: user.name, email: user.email, state: user.state, grants: user.grants.map(({ role, scope }) => ({ role, scope })), reason: '', reset: false, idempotencyKey: '' } : { ...blank, grants: [] }
      setIdentity(loaded.identity); setContext(loaded.context); setForm(next); setInitial(JSON.stringify(next)); setReview(false); setConfirmed(false); operation.current = null; invalidated.current = false
    } catch (failure) { if (!controller.signal.aborted) setError(errors[failure instanceof Error && 'code' in failure ? String(failure.code) : ''] ?? 'mgrUnavailable') }
    finally { if (!controller.signal.aborted) setBusy(false) }
  }, [userId])
  useEffect(() => { let active = true; void Promise.resolve().then(() => { if (active) void load() }); return () => { active = false; request.current?.abort() } }, [load])
  useEffect(() => { if (error) feedback.current?.focus() }, [error])
  useEffect(() => {
    if (!identity) return
    const controller = new AbortController()
    const verify = async () => {
      if (flight.current || document.hidden) return
      try {
        const current = await authService.restore(controller.signal)
        if (!controller.signal.aborted && (!current || current.id !== identity.id || !canAdminUsers(current))) {
          invalidated.current = true; request.current?.abort(); setContext(null); setResult(null); setForm(blank); setBusy(false); setError('homeSignInNote')
        }
      } catch (failure) {
        if (!controller.signal.aborted && failure instanceof Error && 'code' in failure && failure.code === 'SESSION_EXPIRED') { invalidated.current = true; request.current?.abort(); setContext(null); setResult(null); setForm(blank); setBusy(false); setError('homeSignInNote') }
      }
    }
    const timer = window.setInterval(() => void verify(), 60000); window.addEventListener('focus', verify)
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener('focus', verify) }
  }, [identity])

  useEffect(() => {
    if (!dirty) return
    const before = (event: BeforeUnloadEvent) => { if (!allowLeave.current) { event.preventDefault(); event.returnValue = '' } }
    const click = (event: MouseEvent) => { if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return; const link = (event.target as HTMLElement).closest('a[href]'); if (link && !event.defaultPrevented) { if (window.confirm(t('uaLeave'))) allowLeave.current = true; else event.preventDefault() } }
    window.addEventListener('beforeunload', before); document.addEventListener('click', click)
    return () => { window.removeEventListener('beforeunload', before); document.removeEventListener('click', click) }
  }, [dirty, t])
  useEffect(() => {
    const bus = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('fgae.auth') : null
    if (bus) bus.onmessage = () => { invalidated.current = true; request.current?.abort(); setContext(null); setIdentity(null); setResult(null); setForm(blank); setBusy(false); setError('homeSignInNote') }
    return () => bus?.close()
  }, [])
  useEffect(() => {
    if (!result?.temporaryPassword) return
    const clear = () => { setResult(old => old ? { ...old, temporaryPassword: null } : null); setRevealed(false) }
    const timer = window.setTimeout(clear, 300000); window.addEventListener('pagehide', clear)
    return () => { clearTimeout(timer); window.removeEventListener('pagehide', clear) }
  }, [result?.temporaryPassword])
  const update = (next: Partial<AccessInput>) => { allowLeave.current = false; setForm(old => ({ ...old, ...next })); setConfirmed(false); setNotice(null); setError(null) }
  const editGrant = (index: number, role: Role, scopeIndex?: number) => {
    const options = context!.scopes.filter(scope => scope.roles.includes(role)); const selected = options[scopeIndex ?? 0]
    if (!selected) { setError('uaNoScopes'); return }
    update({ grants: form.grants.map((grant, i) => i === index ? { role, scope: { kind: selected.kind, id: selected.id } } : grant) })
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (flight.current || busy || invalidated.current || !context) return
    setError(null)
    try { validateAccess({ ...form, idempotencyKey: 'validation' }, context.scopes) } catch { setError('uaValidation'); return }
    if (!review) { setReview(true); setConfirmed(false); requestAnimationFrame(() => heading.current?.focus()); return }
    if (!confirmed) { setError('uaValidation'); return }
    flight.current = true; setBusy(true); const controller = new AbortController(); request.current = controller
    const payload = JSON.stringify(form); if (operation.current?.payload !== payload) operation.current = { payload, key: crypto.randomUUID() }
    try {
      const saved = await accessService.save({ ...form, idempotencyKey: operation.current.key }, controller.signal)
      if (controller.signal.aborted) return
      if (saved.record.user.id === identity?.id) { invalidated.current = true; setContext(null); setForm(blank); setError('uaOwnChanged'); const bus = new BroadcastChannel('fgae.auth'); bus.postMessage('access-changed'); bus.close() }
      else { setResult(saved); setInitial(JSON.stringify(form)); setRevealed(false); requestAnimationFrame(() => heading.current?.focus()) }
    } catch (failure) {
      if (!controller.signal.aborted) {
        const code = failure instanceof AccessError || failure instanceof Error && 'code' in failure ? String(failure.code) : ''
        setError(errors[code] ?? 'mgrUnavailable')
        if (['FORBIDDEN','SESSION_EXPIRED'].includes(code)) { invalidated.current = true; setContext(null); setResult(null); setForm(blank) }
      }
    } finally { if (!controller.signal.aborted) setBusy(false); flight.current = false }
  }
  const scopeLabel = (scope: { kind: string; name?: string; scopeName?: string }) => scope.kind === 'global' ? t('scopeGlobal') : scope.kind === 'self' ? t('scopeSelf') : scope.kind === 'supervision' ? t('scopeSupervision') : scope.name ?? scope.scopeName ?? ''
  const title = result ? 'uaSaved' : review ? 'uaReview' : mode === 'create' ? 'uaCreate' : mode === 'edit' ? 'uaEdit' : 'uaDetails'
  const summary = (user: DirectoryUser) => <dl className="portfolio-facts"><div><dt>{t('uaName')}</dt><dd>{user.name}</dd></div><div><dt>{t('uaEmail')}</dt><dd>{user.email}</dd></div><div><dt>{t('uaState')}</dt><dd>{t(states[user.state])}</dd></div><div><dt>{t('uaGrants')}</dt><dd>{user.grants.length ? user.grants.map((grant, index) => <p key={index}>{t(grant.role)} · {scopeLabel({ ...grant.scope, scopeName: grant.scopeName })}</p>) : t('uaNoGrants')}</dd></div></dl>
  const preview: DirectoryUser = { id: form.id ?? '@self', name: form.name, email: form.email, state: form.state, mustChangePassword: form.reset || !form.id || context?.record?.user.mustChangePassword || false, grants: form.grants.map(grant => ({ ...grant, scopeName: context?.scopes.find(scope => scope.kind === grant.scope.kind && scope.id === grant.scope.id)?.name ?? grant.scope.id })) }
  return <section className="workspace-page user-access-page motion-enter" aria-labelledby="access-heading">
    <a className="text-link" href="/users">{t('uaBack')}</a><div className="application-heading"><div><p className="eyebrow">{t('usersHeading')}</p><h1 id="access-heading" ref={heading} tabIndex={-1}>{t(title)}</h1><p className="form-subtitle">{t('uaIntro')}</p></div></div>
    {error && <div ref={feedback} className="feedback error" role="alert" tabIndex={-1}><p>{t(error)}</p>{!context ? <><a href="/sign-in">{t('resetSignIn')}</a><Button className="secondary" disabled={busy} onClick={() => void load()}>{t('appRetry')}</Button></> : <Button className="secondary" disabled={busy} onClick={() => { if (!dirty || window.confirm(t('uaLeave'))) void load() }}>{t('uaReload')}</Button>}</div>}
    {busy && <p className="session-check" role="status"><span className="spinner" aria-hidden="true" />{t(context ? 'uaSaving' : 'uaLoading')}</p>}
    {result ? <section className="application-card"><h2>{t('uaSaved')}</h2>{summary(result.record.user)}{result.replayed && <p>{t('uaReplayed')}</p>}{(!form.id || form.reset) && <div className="access-handover"><h3>{t('uaHandover')}</h3><p>{t('uaHandoverNote')}</p>{result.temporaryPassword ? <><div className="field"><label htmlFor="handover-password">{t('uaHandover')}</label><input id="handover-password" readOnly type={revealed ? 'text' : 'password'} value={result.temporaryPassword} autoComplete="off" /></div><div className="access-actions"><Button className="secondary" aria-pressed={revealed} onClick={() => setRevealed(!revealed)}>{t(revealed ? 'uaHide' : 'uaReveal')}</Button><Button className="secondary" onClick={() => { void navigator.clipboard?.writeText(result.temporaryPassword!).then(() => setNotice('uaCopied')).catch(() => setNotice('uaCopyFailed')); if (!navigator.clipboard) setNotice('uaCopyFailed') }}>{t('uaCopy')}</Button></div></> : <p>{t('uaLost')}</p>}</div>}{notice && <p role="status">{t(notice)}</p>}<a className="secondary action-link" href={`/users/${encodeURIComponent(result.record.user.id)}`}>{t('uaView')}</a></section> : context && mode === 'detail' && context.record ? <>
      <section className="application-card">{summary(context.record.user)}<p className="workspace-badge">{t(context.record.user.mustChangePassword ? 'uaTemporary' : 'uaReady')}</p><div className="access-actions"><a className="primary action-link" href={`/users/${encodeURIComponent(userId!)}/edit`}>{t('uaEdit')}</a></div></section>
      <section className="application-card manager-section"><h2>{t('uaHistory')}</h2>{context.record.history.length ? [...context.record.history].reverse().map(row => <article className="access-audit" key={row.id}><h3>{t(row.action === 'CREATE' ? 'uaAuditCreate' : row.action === 'RESET' ? 'uaAuditReset' : 'uaAuditUpdate')}</h3><p>{row.actor} · <time dateTime={row.at}>{new Intl.DateTimeFormat(locale, { calendar: 'gregory', timeZone: 'Africa/Addis_Ababa', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(row.at))}</time></p><p>{row.reason}</p><Accordion id={`audit-${row.id}`} label={`${t('uaBefore')} / ${t('uaAfter')}`}><h4>{t('uaBefore')}</h4>{row.before ? summary(row.before) : <p>{t('uaNoAccount')}</p>}<h4>{t('uaAfter')}</h4>{summary(row.after)}</Accordion></article>) : <p>{t('uaNoHistory')}</p>}</section>
    </> : context && <form onSubmit={event => void submit(event)} noValidate aria-busy={busy}>
      {review ? <section className="application-card"><h2>{t('uaReview')}</h2>{context.record && <><h3>{t('uaBefore')}</h3>{summary(context.record.user)}<h3>{t('uaAfter')}</h3></>}{summary(preview)}<p>{form.reason}</p><p>{t('uaImpact')}</p>{form.reset && <p>{t('uaResetNote')}</p>}<label className="registration-confirm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />{t('uaConfirm')}</label></section> : <>
        <section className="application-card"><div className="access-fields"><div className="field"><label htmlFor="access-name">{t('uaName')}</label><input id="access-name" value={form.name} readOnly={mode === 'edit'} disabled={busy} maxLength={150} onChange={event => update({ name: event.target.value })} /></div><div className="field"><label htmlFor="access-email">{t('uaEmail')}</label><input id="access-email" type="email" value={form.email} readOnly={mode === 'edit'} disabled={busy} maxLength={254} onChange={event => update({ email: event.target.value.trim().toLowerCase() })} /></div><AccordionSelect id="access-state" label={t('uaState')} value={form.state} disabled={busy} onChange={value => update({ state: value as AccessInput['state'] })} options={Object.entries(states).filter(([value]) => mode === 'create' ? value === 'ACTIVE' : value !== 'PENDING' || context.record?.user.state === 'PENDING').map(([value, label]) => ({ value, label: t(label) }))} /></div></section>
        <section className="application-card manager-section"><Accordion id="access-grants" label={t('uaGrants')} initialOpen><p>{t('uaGrantNote')}</p><AnimatedResults changeKey={JSON.stringify(form.grants)}>{form.grants.map((grant, index) => { const scopes = context.scopes.filter(scope => scope.roles.includes(grant.role)); return <div className="access-grant" key={index}><AccordionSelect id={`access-role-${index}`} label={`${t('uaRole')} ${index + 1}`} value={grant.role} disabled={busy} options={roles.map(value => ({ value, label: t(value) }))} onChange={value => editGrant(index, value as Role)} /><AccordionSelect id={`access-scope-${index}`} label={`${t('uaScope')} ${index + 1}`} value={String(scopes.findIndex(scope => scope.kind === grant.scope.kind && scope.id === grant.scope.id))} disabled={busy} options={scopes.map((scope, i) => ({ value: String(i), label: scopeLabel(scope) }))} onChange={value => editGrant(index, grant.role, Number(value))} /><Button className="secondary" disabled={busy} aria-label={`${t('uaRemove')} ${index + 1}`} onClick={() => update({ grants: form.grants.filter((_, i) => i !== index) })}>{t('uaRemove')}</Button></div> })}</AnimatedResults><Button className="secondary" disabled={busy} onClick={() => { const scope = context.scopes.find(scope => scope.roles.includes('VOLUNTEER')); if (scope) update({ grants: [...form.grants, { role: 'VOLUNTEER', scope: { kind: scope.kind, id: scope.id } }] }); else setError('uaNoScopes') }}>{t('uaAdd')}</Button></Accordion></section>
        <section className="application-card manager-section"><p className="workspace-footnote">{t('uaImpact')}</p>{mode === 'edit' && userId !== identity?.id && <label className="registration-confirm"><input type="checkbox" checked={form.reset} disabled={busy} onChange={event => update({ reset: event.target.checked })} /><span>{t('uaReset')}<small>{t('uaResetNote')}</small></span></label>}<div className="field"><label htmlFor="access-reason">{t('uaReason')}</label><textarea id="access-reason" value={form.reason} maxLength={1000} disabled={busy} onChange={event => update({ reason: event.target.value })} aria-describedby="access-reason-hint" /><p id="access-reason-hint" className="field-hint">{t('uaReasonHint')}</p></div></section>
      </>}
      <div className="access-actions">{review && <Button className="secondary" disabled={busy} onClick={() => { setReview(false); setConfirmed(false) }}>{t('uaBackEdit')}</Button>}<Button className="primary" type="submit" disabled={busy || review && !confirmed}>{t(review ? 'uaSave' : 'uaReview')}</Button><a href={userId ? `/users/${encodeURIComponent(userId)}` : '/users'} className="text-link">{t('uaCancel')}</a></div>
    </form>}
  </section>
}
