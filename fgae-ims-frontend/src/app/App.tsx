import { Areas } from '../features/areas/Areas'
import { UserAccess } from '../features/users/UserAccess'
import { WorkspaceNavigation } from '../components/WorkspaceNavigation'
import { PortfolioWorkspace } from '../features/workspaces/PortfolioWorkspace'
import type { PortfolioKind } from '../services/contracts/portfolio'
import { ParticipantOverview } from '../features/workspaces/ParticipantOverview'
import type { ParticipantKind } from '../services/contracts/participant-overview'
import { ManagerOverview } from '../features/workspaces/ManagerOverview'
import type { ManagerKind } from '../services/contracts/manager-overview'
import { HrOverview } from '../features/workspaces/HrOverview'
import { SuperAdmin } from '../features/workspaces/SuperAdmin'
import { Account } from '../features/account/Account'
import { CorrectApplication } from '../features/applications/CorrectApplication'
import { MyApplication } from '../features/applications/MyApplication'
import { ClipboardTextIcon, UsersThreeIcon, HandshakeIcon } from '@phosphor-icons/react'
import { useLocale } from '../i18n/locale'
import { SignIn } from '../features/auth/SignIn'
import { LanguageSelector } from '../components/LanguageSelector'
import { ForgotPassword } from '../features/auth/ForgotPassword'
import { ResetPassword } from '../features/auth/ResetPassword'
import { FirstLogin } from '../features/auth/FirstLogin'
import { Register } from '../features/auth/Register'

export function App({ protectedEntry = false, page = 'sign-in', resetToken = '', accessId, areaId }: { protectedEntry?: boolean; areaId?: string; accessId?: string; page?: 'areas-list' | 'areas-create' | 'areas-detail' | 'access-create' | 'access-detail' | 'access-edit' | 'sign-in' | 'recovery' | 'reset' | 'first' | 'register' | 'application' | 'corrections' | 'account' | 'overview' | 'hr' | ManagerKind | ParticipantKind | PortfolioKind; resetToken?: string }) {
  const { t } = useLocale()
  const areaPage = page === 'areas-list' || page === 'areas-create' || page === 'areas-detail'
  const accessPage = page === 'access-create' || page === 'access-detail' || page === 'access-edit'
  const portfolioPage = page === 'project-manager' || page === 'member' || page === 'users'
  const participantPage = page === 'field-supervisor' || page === 'finance-officer' || page === 'volunteer'
  const managerPage = page === 'area-manager' || page === 'branch-manager' || page === 'volunteer-manager'
  const headingId = areaPage ? 'areas-heading' : accessPage ? 'access-heading' : portfolioPage ? 'portfolio-heading' : participantPage ? 'participant-heading' : managerPage ? 'manager-heading' : page === 'hr' ? 'hr-heading' : page === 'overview' ? 'overview-heading' : page === 'account' ? 'account-heading' : page === 'corrections' ? 'correction-heading' : page === 'application' ? 'application-heading' : page === 'register' ? 'register-heading' : page === 'first' ? 'first-heading' : page === 'reset' ? 'reset-heading' : page === 'recovery' ? 'recovery-heading' : 'sign-in-heading'
  return <>
    <a className="skip-link" href={`#${headingId}`}>{t(areaPage ? 'orgAreas' : accessPage ? 'uaDetails' : portfolioPage || participantPage || managerPage ? 'mgrSkip' : page === 'hr' ? 'hrSkip' : page === 'overview' ? 'homeSkip' : page === 'account' ? 'acctSkip' : page === 'corrections' ? 'corrSkip' : page === 'application' ? 'appSkip' : page === 'register' ? 'regSkip' : page === 'first' ? 'firstSkip' : page === 'reset' ? 'resetSkip' : page === 'recovery' ? 'recoverySkip' : 'skip')}</a>
    <header className="site-header motion-enter">
      <div className="brand"><img src="/brand/mark.svg" width="46" height="46" alt="" /><div><span className="wordmark">FGAE<span className="wordmark-divider">/</span><span className="ims">IMS</span></span><p>{t('organization')}</p></div></div>
      <LanguageSelector />
    </header>
    <main className={areaPage || accessPage || portfolioPage || participantPage || managerPage || page === 'hr' || page === 'overview' || page === 'application' || page === 'corrections' || page === 'account' ? `application-layout${areaPage || accessPage || portfolioPage || participantPage || managerPage || page === 'hr' || page === 'overview' || page === 'account' || page === 'application' || page === 'corrections' ? ' workspace-shell' : ''}` : 'auth-layout'}>
      {(areaPage || accessPage || portfolioPage || participantPage || managerPage || page === 'hr' || page === 'overview' || page === 'account' || page === 'application' || page === 'corrections') && <WorkspaceNavigation />}
      {areaPage ? <Areas key={`${page}:${areaId}`} mode={page === 'areas-create' ? 'create' : page === 'areas-detail' ? 'detail' : 'list'} areaId={areaId} /> : accessPage ? <UserAccess key={`${page}:${accessId}`} mode={page === 'access-create' ? 'create' : page === 'access-edit' ? 'edit' : 'detail'} userId={accessId} /> : portfolioPage ? <PortfolioWorkspace key={page} kind={page} /> : participantPage ? <ParticipantOverview key={page} kind={page} /> : managerPage ? <ManagerOverview key={page} kind={page} /> : page === 'hr' ? <HrOverview /> : page === 'overview' ? <SuperAdmin /> : page === 'account' ? <Account /> : page === 'corrections' ? <CorrectApplication /> : page === 'application' ? <MyApplication /> : <>
      <section className="welcome-panel motion-enter" aria-labelledby="welcome-heading">
        <p className="eyebrow">{t('eyebrow')}</p>
        <h2 id="welcome-heading">{t('headline')}</h2>
        <p className="introduction">{t('introduction')}</p>
        <ul className="purpose-list motion-stagger">
          <li><UsersThreeIcon size={25} weight="regular" aria-hidden="true" /><div><h3>{t('people')}</h3><p>{t('peopleDetail')}</p></div></li>
          <li><HandshakeIcon size={25} weight="regular" aria-hidden="true" /><div><h3>{t('activities')}</h3><p>{t('activitiesDetail')}</p></div></li>
          <li><ClipboardTextIcon size={25} weight="regular" aria-hidden="true" /><div><h3>{t('progress')}</h3><p>{t('progressDetail')}</p></div></li>
        </ul>
        <div className="panel-bottom"><span className="blue-line" aria-hidden="true" /><p>{t('internal')}</p></div>
      </section>
      <div className="form-panel motion-enter">{page === 'register' ? <Register /> : page === 'first' ? <FirstLogin /> : page === 'reset' ? <ResetPassword token={resetToken} /> : page === 'recovery' ? <ForgotPassword /> : <SignIn protectedEntry={protectedEntry} />}</div>
      </>}
    </main>
    <footer className="site-footer"><span>{t('footer')}</span><span>{t('footerNote')}</span></footer>
  </>
}
