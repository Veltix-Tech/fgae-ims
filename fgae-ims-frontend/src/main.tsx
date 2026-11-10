import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/noto-sans/wght.css'
import '@fontsource-variable/noto-sans-ethiopic/wght.css'
import { App } from './app/App'
import { LocaleProvider } from './i18n/locale'
import './styles/global.css'
import './styles/motion.css'

// AUTH-01 is the only implemented route. Future pages are not rendered as placeholders.
const protectedEntry = !['/', '/sign-in'].includes(window.location.pathname)
if (window.location.pathname !== '/sign-in') history.replaceState(null, '', '/sign-in')
createRoot(document.getElementById('root')!).render(<StrictMode><LocaleProvider><App protectedEntry={protectedEntry} /></LocaleProvider></StrictMode>)
