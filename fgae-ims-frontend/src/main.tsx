import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/noto-sans/wght.css'
import '@fontsource-variable/noto-sans-ethiopic/wght.css'
import { App } from './app/App'
import { LocaleProvider } from './i18n/locale'
import './styles/global.css'
import './styles/motion.css'

// Only reviewed/current pages are routed; future destinations have no placeholder UI.
const page = window.location.pathname === '/reset-password' ? 'reset' : window.location.pathname === '/forgot-password' ? 'recovery' : 'sign-in'
const protectedEntry = !['/', '/sign-in', '/forgot-password', '/reset-password'].includes(window.location.pathname)
// C-AUTH-06: the email link carries a fragment token, consumed into memory and removed from history.
const resetTokens = page === 'reset' ? new URLSearchParams(window.location.hash.slice(1)).getAll('token') : []
const resetToken = resetTokens.length === 1 && resetTokens[0]!.length <= 2048 ? resetTokens[0]! : ''
if (page === 'reset') history.replaceState(null, '', '/reset-password')
if (page === 'sign-in' && window.location.pathname !== '/sign-in') history.replaceState(null, '', '/sign-in')
createRoot(document.getElementById('root')!).render(<StrictMode><LocaleProvider><App page={page} protectedEntry={protectedEntry} resetToken={resetToken} /></LocaleProvider></StrictMode>)
