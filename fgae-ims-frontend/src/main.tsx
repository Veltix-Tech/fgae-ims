import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/noto-sans/wght.css'
import '@fontsource-variable/noto-sans-ethiopic/wght.css'
import { App } from './app/App'
import { LocaleProvider } from './i18n/locale'
import './styles/global.css'
import './styles/motion.css'

// Only reviewed/current pages are routed; future destinations have no placeholder UI.
const page = window.location.pathname === '/forgot-password' ? 'recovery' : 'sign-in'
const protectedEntry = !['/', '/sign-in', '/forgot-password'].includes(window.location.pathname)
if (page === 'sign-in' && window.location.pathname !== '/sign-in') history.replaceState(null, '', '/sign-in')
createRoot(document.getElementById('root')!).render(<StrictMode><LocaleProvider><App page={page} protectedEntry={protectedEntry} /></LocaleProvider></StrictMode>)
