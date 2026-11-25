import { DirectoryToolbar } from '../../components/DirectoryToolbar'
import { BuildingsIcon, ArrowUpRightIcon, ArrowClockwiseIcon } from '@phosphor-icons/react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { authService } from '@auth-adapter'
import { areaService } from '@areas-adapter'
import { Accordion, AccordionSelect } from '../../components/Accordion'
import { AnimatedResults } from '../../components/AnimatedResults'
import { Button } from '../../components/Button'
import { useLocale } from '../../i18n/locale'
import type { TranslationKey } from '../../i18n/locales/en/auth'
import type { Identity } from '../../services/contracts/auth'
import { canCreateArea, canReadAreas, validateArea, type AreaInput, type AreaSnapshot } from '../../services/contracts/areas'
const blank: AreaInput = { name: '', code: '', description: '', reason: '', idempotencyKey: '' }
const messages: Record<string, TranslationKey> = { FORBIDDEN: 'mgrDeniedNote', SESSION_EXPIRED: 'homeSignInNote', NETWORK: 'NETWORK', STORAGE_UNAVAILABLE: 'STORAGE_UNAVAILABLE', RATE_LIMITED: 'RATE_LIMITED', DUPLICATE: 'orgDuplicate', CONFLICT: 'orgConflict', VALIDATION: 'orgValidation' }
const errorKey = (error: unknown) => messages[error instanceof Error && 'code' in error ? String(error.code) : ''] ?? 'mgrUnavailable'
const signature = (identity: Identity) => JSON.stringify([identity.id,identity.accountState,identity.mustChangePassword,identity.grants])
export function Areas({ mode, areaId }: { mode: 'list' | 'create' | 'detail'; areaId?: string }) {
  const { t, locale } = useLocale()
  const [snapshot,setSnapshot] = useState<AreaSnapshot | null>(null); const [identity,setIdentity] = useState<Identity | null>(null)
  const [busy,setBusy] = useState(true); const [error,setError] = useState<TranslationKey | null>(null)
  const [form,setForm] = useState(blank); const [review,setReview] = useState(false); const [confirmed,setConfirmed] = useState(false); const [saved,setSaved] = useState<string | null>(null)
  const [query,setQuery] = useState(() => new URLSearchParams(location.search).get('q')?.slice(0,120) ?? '')
  const [status,setStatus] = useState(() => { const value = new URLSearchParams(location.search).get('status'); return value === 'ACTIVE' || value === 'ARCHIVED' ? value : '' })
  const [page,setPage] = useState(() => Math.max(1,Math.min(100000,Number(new URLSearchParams(location.search).get('page')) || 1)))
  const request = useRef<AbortController | null>(null); const flight = useRef(false); const heading = useRef<HTMLHeadingElement>(null); const results = useRef<HTMLHeadingElement>(null); const feedback = useRef<HTMLDivElement>(null); const leave = useRef(false)
  const operation = useRef<{ payload: string; key: string } | null>(null)
  const dirty = mode === 'create' && !!snapshot && !saved && Object.entries(form).some(([key,value]) => key !== 'idempotencyKey' && !!value)
  const load = useCallback(async () => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller; setBusy(true); setError(null)
    try { const data = await areaService.load(controller.signal); if (controller.signal.aborted) return; if (mode === 'create' && !canCreateArea(data.identity)) { setSnapshot(null); setError('mgrDeniedNote'); return }; setIdentity(data.identity); setSnapshot(data.snapshot) }
    catch (failure) { if (!controller.signal.aborted) { setSnapshot(null); setError(errorKey(failure)) } }
    finally { if (!controller.signal.aborted) setBusy(false) }
  },[mode])
  useEffect(() => { let active = true; void Promise.resolve().then(() => { if (active) void load() }); return () => { active = false; request.current?.abort() } },[load])
  useEffect(() => { if (error) feedback.current?.focus({ preventScroll: true }) },[error])
  useEffect(() => {
    const controller = new AbortController()
    const clear = () => { request.current?.abort(); setSnapshot(null); setIdentity(null); setForm(blank); setSaved(null); setBusy(false); setError('homeSignInNote') }
    const verify = async () => { if (!identity || flight.current || document.hidden) return; try { const current = await authService.restore(controller.signal); if (!controller.signal.aborted && (!current || !canReadAreas(current) || signature(current) !== signature(identity))) clear() } catch { if (!controller.signal.aborted) clear() } }
    const bus = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('fgae.auth') : null; if (bus) bus.onmessage = clear
    const timer = setInterval(() => void verify(),60000); window.addEventListener('focus',verify)
    return () => { controller.abort(); clearInterval(timer); bus?.close(); window.removeEventListener('focus',verify) }
  },[identity])
  useEffect(() => {
    if (!dirty) return
    const before = (event: BeforeUnloadEvent) => { if (!leave.current) { event.preventDefault(); event.returnValue = '' } }
    const click = (event: MouseEvent) => { if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.shiftKey || event.metaKey || event.altKey) return; const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href]'); if (!link || link.hash && link.pathname === location.pathname) return; if (window.confirm(t('orgLeave'))) leave.current = true; else event.preventDefault() }
    window.addEventListener('beforeunload',before); document.addEventListener('click',click)
    return () => { window.removeEventListener('beforeunload',before); document.removeEventListener('click',click) }
  },[dirty,t])
  const filtered = (snapshot?.areas ?? []).filter(a => (!status || a.state === status) && `${a.name} ${a.code}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).sort((a,b) => a.name.localeCompare(b.name,locale))
  const pages = Math.max(1,Math.ceil(filtered.length / 8)); const currentPage = Math.min(pages,Math.floor(page))
  useEffect(() => { if (mode !== 'list' || !snapshot) return; const url = new URL(location.href); url.searchParams.delete('q'); url.searchParams.delete('status'); url.searchParams.delete('page'); if (query) url.searchParams.set('q',query); if (status) url.searchParams.set('status',status); if (currentPage > 1) url.searchParams.set('page',String(currentPage)); history.replaceState(null,'',url) },[query,status,currentPage,mode,snapshot])
  const change = (key: keyof AreaInput, value: string) => { leave.current = false; setForm(old => ({ ...old,[key]:value })); setError(null); setConfirmed(false) }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (flight.current || busy || !snapshot || !identity || !canCreateArea(identity)) return
    let next: AreaInput; try { next = validateArea({ ...form,idempotencyKey:'validation' }) } catch { setError('orgValidation'); return }
    if (!review) { setForm({ ...next,idempotencyKey:'' }); setReview(true); setConfirmed(false); setError(null); requestAnimationFrame(() => heading.current?.focus({preventScroll:true})); return }
    if (!confirmed) return
    const payload = JSON.stringify(next); if (operation.current?.payload !== payload) operation.current = { payload,key:crypto.randomUUID() }
    const controller = new AbortController(); request.current = controller; flight.current = true; setBusy(true); setError(null)
    try { const result = await areaService.create({ ...next,idempotencyKey:operation.current.key },controller.signal); if (!controller.signal.aborted) { setSaved(result.id); setSnapshot(result.snapshot); requestAnimationFrame(() => heading.current?.focus({preventScroll:true})) } }
    catch (failure) { if (!controller.signal.aborted) { const key = errorKey(failure); setError(key); if (key === 'mgrDeniedNote' || key === 'homeSignInNote') { setSnapshot(null); setForm(blank) } } }
    finally { flight.current = false; if (!controller.signal.aborted) setBusy(false) }
  }
  const area = snapshot?.areas.find(a => a.id === (saved ?? areaId))
  const title = saved ? 'orgSaved' : mode === 'list' ? 'orgAreas' : mode === 'detail' ? 'orgDetail' : review ? 'orgReview' : 'orgCreate'
  const date = (at: string) => new Intl.DateTimeFormat(locale,{calendar:'gregory',timeZone:'Africa/Addis_Ababa',dateStyle:'medium',timeStyle:'short'}).format(new Date(at))
  const facts = (a: Pick<AreaInput,'code'|'name'|'description'>) => <dl className="portfolio-facts"><div><dt>{t('orgName')}</dt><dd>{a.name}</dd></div><div><dt>{t('orgCode')}</dt><dd>{a.code}</dd></div><div className="area-description"><dt>{t('orgDescription')}</dt><dd>{a.description || t('orgNoDescription')}</dd></div></dl>
  return <section className="workspace-page portfolio-page areas-page motion-enter" aria-labelledby="areas-heading">
    {mode !== 'list' && <a href="/areas" className="text-link">{t('orgBack')}</a>}
    <div className="application-heading"><div><p className="eyebrow">{t('orgScope')}</p><h1 id="areas-heading" ref={heading} tabIndex={-1}>{t(title)}</h1><p className="form-subtitle">{t(mode === 'create' ? 'orgCreateIntro' : 'orgIntro')}</p></div></div>
    {error && <div ref={feedback} role="alert" tabIndex={-1} className="feedback error"><p>{t(error)}</p>{!snapshot && <><Button className="secondary" disabled={busy} onClick={() => void load()}>{t('appRetry')}</Button><a href="/sign-in">{t('resetSignIn')}</a></>}</div>}
    {busy && <p className="session-check" role="status"><span className="spinner" aria-hidden="true" />{t(snapshot && mode === 'create' ? 'orgSaving':snapshot ? 'orgRefreshing':'orgLoading')}</p>}
    {snapshot && mode === 'list' && <section className="application-card area-directory" aria-labelledby="area-directory-heading"><DirectoryToolbar href={identity && canCreateArea(identity) ? '/areas/new' : undefined} label={t('orgCreate')}><h2 id="area-directory-heading">{t('orgAreas')}</h2><p className="step-intro">{t('orgRelationshipNote')}</p></DirectoryToolbar>
      <div className="directory-filters"><div className="field"><label htmlFor="area-search">{t('orgSearch')}</label><input id="area-search" type="search" maxLength={120} value={query} onChange={e => { setQuery(e.target.value); setPage(1) }} /></div><AccordionSelect id="area-status" label={t('orgState')} value={status} onChange={value => {setStatus(value);setPage(1)}} options={[{value:'',label:t('orgAll')},{value:'ACTIVE',label:t('orgActive')},{value:'ARCHIVED',label:t('orgArchived')}]} /><Button className="secondary" onClick={() => {setQuery('');setStatus('');setPage(1)}}>{t('portClear')}</Button></div>
      <div className="area-result-heading"><h3 ref={results} tabIndex={-1}>{t('orgResults')} <span className="application-count">{new Intl.NumberFormat(locale).format(filtered.length)}</span></h3><span className="sr-only" role="status">{t('orgResults')}: {new Intl.NumberFormat(locale).format(filtered.length)}</span><Button className="secondary" disabled={busy} onClick={() => void load()}><ArrowClockwiseIcon size={17} aria-hidden="true" />{t('orgRefresh')}</Button></div><div className="area-columns" aria-hidden="true"><span>{t('orgName')}</span><span>{t('orgState')}</span><span>{t('orgBranches')}</span><span /></div>
      <AnimatedResults changeKey={`${query}:${status}:${currentPage}:${filtered.map(a => a.id).join(',')}`}><ul className="area-list">{filtered.slice((currentPage-1)*8,currentPage*8).map(a => <li key={a.id}><div className="area-identity"><span className="area-symbol"><BuildingsIcon size={22} aria-hidden="true" /></span><div><h3><a className="area-name-link" href={`/areas/${encodeURIComponent(a.id)}`}>{a.name}</a></h3><p>{a.code}</p></div></div><span className="workspace-badge">{t(a.state === 'ACTIVE' ? 'orgActive':'orgArchived')}</span><p className="area-branch-count"><span className="area-mobile-label">{t('orgBranches')}: </span>{new Intl.NumberFormat(locale).format(snapshot.branches.filter(b => b.areaId === a.id).length)}</p><ArrowUpRightIcon className="area-row-arrow" size={18} aria-hidden="true" /></li>)}</ul>{!filtered.length && <p className="workspace-empty">{t(snapshot.areas.length ? 'orgEmpty':'orgNoAreas')}</p>}</AnimatedResults>
      <nav className="directory-pages" aria-label={t('portPage')}><Button className="secondary" disabled={currentPage <= 1} onClick={() => {setPage(currentPage-1);results.current?.focus({preventScroll:true})}}>{t('portPrevious')}</Button><span>{t('portPage')} {currentPage} {t('portOf')} {pages}</span><Button className="secondary" disabled={currentPage >= pages} onClick={() => {setPage(currentPage+1);results.current?.focus({preventScroll:true})}}>{t('portNext')}</Button></nav>
    </section>}
    {snapshot && (mode === 'detail' || saved) && (area ? <><section className="application-card"><DirectoryToolbar href={identity && canCreateArea(identity) && !saved ? `/areas/${encodeURIComponent(area.id)}/edit` : undefined} label={t('orgEdit')}><h2>{area.name}</h2></DirectoryToolbar><span className="workspace-badge">{t(area.state === 'ACTIVE' ? 'orgActive':'orgArchived')}</span>{facts(area)}<p>{t('orgCreated')}: <time dateTime={area.createdAt}>{date(area.createdAt)}</time></p>{saved && <a className="primary action-link" href={`/areas/${encodeURIComponent(area.id)}`}>{t('orgView')}</a>}</section>{!saved && <>
      <section className="application-card manager-section"><h2>{t('orgRelationships')}</h2><p>{t('orgRelationshipNote')}</p><Accordion id="area-branches" label={`${t('orgBranches')} (${snapshot.branches.filter(b => b.areaId === area.id).length})`} initialOpen><ul className="area-branches">{snapshot.branches.filter(b => b.areaId === area.id).map(b => <li key={b.id}><span>{b.name}</span><span>{t(b.state === 'ACTIVE' ? 'orgActive':'orgArchived')}</span></li>)}</ul>{!snapshot.branches.some(b => b.areaId === area.id) && <p>{t('orgNoBranches')}</p>}</Accordion><p className="form-subtitle">{t('orgArchiveNote')}</p></section>
      <section className="application-card manager-section"><Accordion id="area-history" label={t('orgHistoryAll')} initialOpen>{area.history.length ? area.history.map(h => <article key={h.id} className="access-audit"><h3>{t(h.action === 'CREATE' ? 'orgCreated' : h.action === 'UPDATE' ? 'orgAuditUpdate' : h.action === 'ARCHIVE' ? 'orgAuditArchive' : 'orgAuditRestore')}</h3><p>{h.actor} · <time dateTime={h.at}>{date(h.at)}</time></p><p>{h.reason}</p>{h.before && h.after && <Accordion id={`area-audit-${h.id}`} label={`${t('uaBefore')} / ${t('uaAfter')}`}><h4>{t('uaBefore')}</h4>{facts(h.before)}<p>{t(h.before.state === 'ACTIVE' ? 'orgActive' : 'orgArchived')}</p><h4>{t('uaAfter')}</h4>{facts(h.after)}<p>{t(h.after.state === 'ACTIVE' ? 'orgActive' : 'orgArchived')}</p></Accordion>}</article>) : <p>{t('orgNoHistory')}</p>}</Accordion></section></>}</> : <div className="feedback" role="status"><p>{t('orgNotFound')}</p></div>)}
    {snapshot && mode === 'create' && !saved && <form onSubmit={event => void submit(event)} noValidate aria-busy={busy}><section className="application-card">{review ? <>{facts(form)}<h2>{t('orgReason')}</h2><p className="area-description">{form.reason}</p><div className="area-confirm"><input id="area-confirm" type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} disabled={busy}/><label htmlFor="area-confirm">{t('orgConfirm')}</label></div></> : <>
      <div className="access-form-grid"><div className="field"><label htmlFor="area-name">{t('orgName')}</label><input id="area-name" value={form.name} required maxLength={120} onChange={e => change('name',e.target.value)} disabled={busy}/></div><div className="field"><label htmlFor="area-code">{t('orgCode')}</label><input id="area-code" value={form.code} required maxLength={20} onChange={e => change('code',e.target.value)} aria-describedby="area-code-help" disabled={busy}/><p id="area-code-help" className="field-help">{t('orgCodeHelp')}</p></div></div>
      <div className="field"><label htmlFor="area-description">{t('orgDescription')}</label><textarea id="area-description" rows={4} maxLength={1000} value={form.description} onChange={e => change('description',e.target.value)} disabled={busy}/></div><div className="field"><label htmlFor="area-reason">{t('orgReason')}</label><textarea id="area-reason" rows={3} maxLength={500} required value={form.reason} onChange={e => change('reason',e.target.value)} aria-describedby="area-reason-help" disabled={busy}/><p id="area-reason-help" className="field-help">{t('orgReasonHelp')}</p></div></>}
      <div className="access-actions">{review && <Button className="secondary" disabled={busy} onClick={() => {setReview(false);setConfirmed(false);setError(null)}}>{t('orgEditForm')}</Button>}<Button type="submit" className="primary" disabled={busy || review && !confirmed}>{t(review ? 'orgSave':'orgReview')}</Button></div></section></form>}
    {snapshot && identity && !canCreateArea(identity) && <p className="workspace-badge">{t('orgReadOnly')}</p>}
  </section>
}
