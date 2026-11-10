import { useEffect, useRef, useState } from 'react'
import { CaretDownIcon, CheckIcon, GlobeHemisphereEastIcon } from '@phosphor-icons/react'
import { useLocale } from '../i18n/locale'

export function LanguageSelector() {
  const { locale, setLocale, t } = useLocale()
  const [open, setOpen] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])

  return <div className="language-control" ref={container}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}
    onKeyDown={event => {
      if (event.key === 'Escape' && open) { event.preventDefault(); setOpen(false); trigger.current?.focus() }
    }}>
    <button id="language" ref={trigger} className="language-trigger" type="button"
      aria-label={`${t('language')}: ${t(locale === 'en' ? 'english' : 'amharic')}`}
      aria-expanded={open} aria-controls="language-options" onClick={() => setOpen(!open)}>
      <GlobeHemisphereEastIcon className="language-globe" size={19} aria-hidden="true" />
      <span lang={locale}>{t(locale === 'en' ? 'english' : 'amharic')}</span>
      <CaretDownIcon className="language-chevron" size={14} aria-hidden="true" />
    </button>
    <div id="language-options" className="language-options" hidden={!open} role="group" aria-label={t('language')}>
      <p className="language-caption">{t('language')}</p>
      {(['en', 'am'] as const).map(value => <button type="button" key={value} lang={value}
        className="language-option" aria-pressed={locale === value}
        onClick={() => { setLocale(value); setOpen(false); trigger.current?.focus() }}>
        <span>{t(value === 'en' ? 'english' : 'amharic')}</span>
        {locale === value && <CheckIcon size={17} weight="bold" aria-hidden="true" />}
      </button>)}
    </div>
  </div>
}
