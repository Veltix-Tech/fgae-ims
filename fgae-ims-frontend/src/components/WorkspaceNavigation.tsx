import { canReadOwnApplication } from '../services/contracts/application'
import { useEffect, useRef, useState } from 'react'
import { ListIcon, XIcon } from '@phosphor-icons/react'
import { Button } from './Button'
import { authService } from '@auth-adapter'
import type { Identity } from '../services/contracts/auth'
import { canReadOverview } from '../services/contracts/overview'
import { canReadHr } from '../services/contracts/hr-overview'
import { canReadManager, managerKinds } from '../services/contracts/manager-overview'
import { canReadParticipant, participantKinds } from '../services/contracts/participant-overview'
import { canReadPortfolio, portfolioKinds, portfolioPath } from '../services/contracts/portfolio'
import { canManageAccount } from '../services/contracts/account'
import { useLocale } from '../i18n/locale'
import type { TranslationKey } from '../i18n/locales/en/auth'
import { Accordion } from './Accordion'

export function WorkspaceNavigation() {
  const { t } = useLocale()
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 1200px)').matches)
  const [open, setOpen] = useState(false)
  const canOpen = !!identity && !identity.mustChangePassword
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1200px)')
    const resize = () => { setMobile(media.matches); setOpen(false) }
    media.addEventListener('change', resize)
    return () => media.removeEventListener('change', resize)
  }, [])
  useEffect(() => {
    const sheet = dialog.current
    if (!open || !mobile || !canOpen || !sheet) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    sheet.showModal()
    return () => { sheet.close(); document.body.style.overflow = previousOverflow }
  }, [open, mobile, canOpen])
  useEffect(() => {
    let controller: AbortController | undefined
    const refresh = () => {
      controller?.abort(); controller = new AbortController()
      const signal = controller.signal
      authService.restore(signal).then(value => { if (!signal.aborted) setIdentity(value) }).catch(() => { if (!signal.aborted) setIdentity(null) })
    }
    refresh()
    const bus = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('fgae.auth') : null
    if (bus) bus.onmessage = () => { controller?.abort(); setIdentity(null) }
    window.addEventListener('focus', refresh)
    const timer = window.setInterval(refresh, 60000)
    return () => { controller?.abort(); bus?.close(); clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [])
  if (!identity || identity.mustChangePassword) return null
  const overview: { href: string; label: TranslationKey }[] = []
  if (canReadOverview(identity)) overview.push({ href: '/workspaces/super-admin', label: 'homeLink' })
  if (canReadHr(identity)) overview.push({ href: '/workspaces/hr', label: 'hrLink' })
  managerKinds.filter(kind => canReadManager(identity, kind)).forEach(kind => overview.push({ href: `/workspaces/${kind}`, label: kind === 'area-manager' ? 'areaLink' : kind === 'branch-manager' ? 'branchLink' : 'vmLink' }))
  participantKinds.filter(kind => canReadParticipant(identity, kind)).forEach(kind => overview.push({ href: `/workspaces/${kind}`, label: kind === 'field-supervisor' ? 'supervisorLink' : kind === 'finance-officer' ? 'financeLink' : 'volunteerLink' }))
  portfolioKinds.filter(kind => kind !== 'users' && canReadPortfolio(identity, kind)).forEach(kind => overview.push({ href: portfolioPath(kind), label: kind === 'project-manager' ? 'projectLink' : 'memberLink' }))
  const links = (items: typeof overview) => items.map(item => <a key={item.href} href={item.href} aria-label={`${t('navGoTo')}: ${t(item.label)}`} aria-current={location.pathname === item.href ? 'page' : undefined}>{t(item.label)}</a>)
  const groups = <>
    {canReadPortfolio(identity, 'users') && <Accordion id="nav-administration" label={t('navAdministration')} initialOpen>{links([{ href: '/users', label: 'usersLink' }])}</Accordion>}
    {overview.length > 0 && <Accordion id="nav-workspaces" label={t('navWorkspaces')} initialOpen>{links(overview)}</Accordion>}
    {canManageAccount(identity) && <Accordion id="nav-account" label={t('acctLink')}>{links([{ href: '/account', label: 'acctLink' }, ...(canReadOwnApplication(identity) ? [{ href: '/my-application', label: 'appLink' as const }] : []), { href: '/sign-in', label: 'navAllWorkspaces' }])}</Accordion>}
  </>
  if (mobile) return <aside className="mobile-navigation-dock">
    <Button ref={trigger} className="mobile-navigation-button" aria-haspopup="dialog" aria-expanded={open} aria-controls="mobile-navigation-sheet" onClick={() => setOpen(true)}><ListIcon size={22} aria-hidden="true" />{t('navMain')}</Button>
    <dialog id="mobile-navigation-sheet" className="mobile-navigation-sheet" ref={dialog} aria-labelledby="mobile-navigation-title" onClose={() => { setOpen(false); trigger.current?.focus({ preventScroll: true }) }} onClick={event => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientY < bounds.top || event.clientX < bounds.left || event.clientX > bounds.right) setOpen(false) } }}>
      <div className="mobile-navigation-heading"><h2 id="mobile-navigation-title">{t('navMain')}</h2><Button className="mobile-navigation-close" aria-label={t('navClose')} onClick={() => setOpen(false)}><XIcon size={23} aria-hidden="true" /></Button></div>
      <nav aria-label={t('navMain')}>{groups}</nav>
    </dialog>
  </aside>
  return <aside className="workspace-sidebar"><nav aria-label={t('navMain')}><p className="eyebrow navigation-heading">{t('navMain')}</p>{groups}</nav></aside>
}
