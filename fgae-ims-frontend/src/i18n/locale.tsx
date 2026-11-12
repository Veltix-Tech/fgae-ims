import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { en, type TranslationKey } from './locales/en/auth'
import { am } from './locales/am/auth'

export type Locale = 'en' | 'am'
const LocaleContext = createContext<{ locale: Locale; setLocale: (locale: Locale) => void; t: (key: TranslationKey) => string } | null>(null)
function initialLocale(): Locale {
  try { return localStorage.getItem('fgae.locale') === 'am' ? 'am' : 'en' } catch { return 'en' }
}
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(initialLocale)
  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = 'ltr'
    document.title = (locale === 'am' ? am : en)[window.location.pathname === '/register' ? 'regTitle' : window.location.pathname === '/first-login' ? 'firstTitle' : window.location.pathname === '/reset-password' ? 'resetTitle' : window.location.pathname === '/forgot-password' ? 'recoveryTitle' : 'title']
    try { localStorage.setItem('fgae.locale', locale) } catch { /* The current form remains usable if storage is disabled. */ }
  }, [locale])
  return <LocaleContext.Provider value={{ locale, setLocale, t: key => (locale === 'am' ? am : en)[key] }}>{children}</LocaleContext.Provider>
}
export function useLocale() {
  const context = useContext(LocaleContext)
  if (!context) throw new Error('LocaleProvider is required')
  return context
}
