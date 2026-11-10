import type { Credentials } from '../../services/contracts/auth'
import type { TranslationKey } from '../../i18n/locales/en/auth'
export function validateSignIn(values: Credentials): Partial<Record<keyof Credentials, TranslationKey>> {
  const errors: Partial<Record<keyof Credentials, TranslationKey>> = {}
  if (!values.email.trim()) errors.email = 'emailRequired'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'emailInvalid'
  // Login must not impose signup password rules on existing credentials.
  if (!values.password) errors.password = 'passwordRequired'
  return errors
}
