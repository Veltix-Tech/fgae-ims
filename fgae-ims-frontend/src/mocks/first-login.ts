import { FirstLoginError, type FirstLoginService } from '../services/contracts/first-login'
import { completeFirstLogin } from './credentials'
import { readSession } from './auth'

export const firstLoginService: FirstLoginService = {
  async complete(input, signal) {
    signal?.throwIfAborted()
    if (!navigator.onLine) throw new FirstLoginError('NETWORK')
    try { await completeFirstLogin(input, readSession, signal) }
    catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'STORAGE_UNAVAILABLE') throw new FirstLoginError('STORAGE_UNAVAILABLE')
      throw error
    }
  },
}
