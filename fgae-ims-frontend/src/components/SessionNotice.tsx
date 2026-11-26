import { LockKeyIcon, ArrowRightIcon } from '@phosphor-icons/react'
import type { Ref } from 'react'
import { Button } from './Button'
import { useLocale } from '../i18n/locale'
import '../styles/session-notice.css'

/** A shared recovery state for protected pages; retry cannot restore a missing session. */
export function SessionNotice({ ref }: { ref?: Ref<HTMLDivElement> }) {
  const { t } = useLocale()
  return <div ref={ref} className="session-notice application-card motion-enter" role="alert" tabIndex={-1}>
    <span className="session-notice-icon" aria-hidden="true"><LockKeyIcon size={28} /></span>
    <div className="session-notice-copy"><h2>{t('sessionTitle')}</h2><p>{t('homeSignInNote')}</p></div>
    <Button className="primary" onClick={() => location.assign('/sign-in')}>{t('resetSignIn')}<ArrowRightIcon size={20} aria-hidden="true" /></Button>
  </div>
}
