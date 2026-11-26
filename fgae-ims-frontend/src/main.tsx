import './styles/areas.css'
import './styles/user-access.css'
import { portfolioKinds, portfolioPath } from './services/contracts/portfolio'
import './styles/portfolio.css'
import { participantKinds } from './services/contracts/participant-overview'
import './styles/participants.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/noto-sans/wght.css'
import '@fontsource-variable/noto-sans-ethiopic/wght.css'
import { App } from './app/App'
import { LocaleProvider } from './i18n/locale'
import './styles/global.css'
import './styles/motion.css'
import './styles/scrolling.css'
import './styles/registration.css'
import './styles/application.css'
import './styles/corrections.css'
import './styles/account.css'
import './styles/workspace.css'
import './styles/hr.css'
import './styles/managers.css'
import { managerKinds } from './services/contracts/manager-overview'

// Only reviewed/current pages are routed; future destinations have no placeholder UI.
const managerPage = managerKinds.find(kind => window.location.pathname === `/workspaces/${kind}`)
const participantPage = participantKinds.find(kind => window.location.pathname === `/workspaces/${kind}`)
const portfolioPage = portfolioKinds.find(kind => window.location.pathname === portfolioPath(kind))
const accessRoute = /^\/users\/([^/]+)(\/edit)?$/.exec(window.location.pathname)
let accessId: string | undefined
if (accessRoute && accessRoute[1] !== 'new') { try { accessId = decodeURIComponent(accessRoute[1]!) } catch { accessId = 'invalid-path' } }
const accessPage = accessRoute ? accessRoute[1] === 'new' ? 'access-create' : accessRoute[2] ? 'access-edit' : 'access-detail' : undefined
const areaRoute = /^\/areas(?:\/([^/]+))?(\/edit)?$/.exec(window.location.pathname)
let areaId: string | undefined
if (areaRoute?.[1] && areaRoute[1] !== 'new') { try { areaId = decodeURIComponent(areaRoute[1]) } catch { areaId = 'invalid-path' } }
const areaPage = areaRoute ? !areaRoute[1] ? 'areas-list' : areaRoute[1] === 'new' ? 'areas-create' : areaRoute[2] ? 'areas-edit' : 'areas-detail' : undefined
const branchRoute = /^\/branches\/([^/]+)(\/edit)?$/.exec(window.location.pathname)
let branchId: string | undefined
if (branchRoute && branchRoute[1] !== 'new') { try { branchId = decodeURIComponent(branchRoute[1]!) } catch { branchId = 'invalid-path' } }
const branchPage = window.location.pathname === '/branches' ? 'branches-list' : window.location.pathname === '/branches/new' ? 'branches-create' : branchRoute && branchId ? branchRoute[2] ? 'branches-edit' : 'branches-detail' : undefined
const facilityPage = window.location.pathname === '/facilities' ? 'facilities-list' : undefined
const page = facilityPage ?? branchPage ?? areaPage ?? accessPage ?? portfolioPage ?? participantPage ?? managerPage ?? (window.location.pathname === '/workspaces/hr' ? 'hr' : window.location.pathname === '/workspaces/super-admin' ? 'overview' : window.location.pathname === '/account' ? 'account' : window.location.pathname === '/my-application/edit' ? 'corrections' : window.location.pathname === '/my-application' ? 'application' : window.location.pathname === '/register' ? 'register' : window.location.pathname === '/first-login' ? 'first' : window.location.pathname === '/reset-password' ? 'reset' : window.location.pathname === '/forgot-password' ? 'recovery' : 'sign-in')
const protectedEntry = !facilityPage && !branchPage && !areaPage && !accessPage && !portfolioPage && !participantPage && !managerPage && !['/', '/sign-in', '/forgot-password', '/reset-password', '/first-login', '/register', '/my-application', '/my-application/edit', '/account', '/workspaces/super-admin', '/workspaces/hr'].includes(window.location.pathname)
// C-AUTH-06: the email link carries a fragment token, consumed into memory and removed from history.
const resetTokens = page === 'reset' ? new URLSearchParams(window.location.hash.slice(1)).getAll('token') : []
const resetToken = resetTokens.length === 1 && resetTokens[0]!.length <= 2048 ? resetTokens[0]! : ''
if (page === 'reset') history.replaceState(null, '', '/reset-password')
if (page === 'sign-in' && window.location.pathname !== '/sign-in') history.replaceState(null, '', '/sign-in')
createRoot(document.getElementById('root')!).render(<StrictMode><LocaleProvider><App branchId={branchId} areaId={areaId} accessId={accessId} page={page} protectedEntry={protectedEntry} resetToken={resetToken} /></LocaleProvider></StrictMode>)
