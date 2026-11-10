import { ResetError, type ResetPasswordService } from '../services/contracts/reset-password'
import { completeRecovery, validateRecoveryLink } from './credentials'

function check(signal?: AbortSignal) {
  signal?.throwIfAborted()
  if (!navigator.onLine) throw new ResetError('NETWORK')
}
export const resetPasswordService: ResetPasswordService = {
  async validate(token, signal) { check(signal); return validateRecoveryLink(token, signal) },
  async complete(input, signal) { check(signal); await completeRecovery(input, signal) },
}
