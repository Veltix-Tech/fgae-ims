import { ClipboardTextIcon, UsersThreeIcon, HandshakeIcon } from '@phosphor-icons/react'
import { useLocale } from '../i18n/locale'
import { SignIn } from '../features/auth/SignIn'
import { LanguageSelector } from '../components/LanguageSelector'

export function App({ protectedEntry = false }: { protectedEntry?: boolean }) {
  const { t } = useLocale()
  return <>
    <a className="skip-link" href="#sign-in-heading">{t('skip')}</a>
    <header className="site-header">
      <div className="brand"><img src="/brand/mark.svg" width="46" height="46" alt="" /><div><span className="wordmark">FGAE<span className="wordmark-divider">/</span><span className="ims">IMS</span></span><p>{t('organization')}</p></div></div>
      <LanguageSelector />
    </header>
    <main className="auth-layout">
      <section className="welcome-panel" aria-labelledby="welcome-heading">
        <p className="eyebrow">{t('eyebrow')}</p>
        <h2 id="welcome-heading">{t('headline')}</h2>
        <p className="introduction">{t('introduction')}</p>
        <ul className="purpose-list">
          <li><UsersThreeIcon size={25} weight="regular" aria-hidden="true" /><div><h3>{t('people')}</h3><p>{t('peopleDetail')}</p></div></li>
          <li><HandshakeIcon size={25} weight="regular" aria-hidden="true" /><div><h3>{t('activities')}</h3><p>{t('activitiesDetail')}</p></div></li>
          <li><ClipboardTextIcon size={25} weight="regular" aria-hidden="true" /><div><h3>{t('progress')}</h3><p>{t('progressDetail')}</p></div></li>
        </ul>
        <div className="panel-bottom"><span className="blue-line" aria-hidden="true" /><p>{t('internal')}</p></div>
      </section>
      <div className="form-panel"><SignIn protectedEntry={protectedEntry} /></div>
    </main>
    <footer className="site-footer"><span>{t('footer')}</span><span>{t('footerNote')}</span></footer>
  </>
}
