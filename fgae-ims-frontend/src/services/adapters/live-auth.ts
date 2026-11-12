import { AuthError, type AuthService } from '../contracts/auth'
import { AuthClient } from '../http/auth-client'
import { mapIdentity } from './auth-dto'

export const client = new AuthClient((import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, ''))
export const authService: AuthService = {
  async signIn(credentials, signal) {
    try { await client.login(credentials, signal); return mapIdentity(await client.me(signal)) }
    catch (error) { client.clear(); throw error }
  },
  async restore(signal) {
    try { await client.refresh(); return mapIdentity(await client.me(signal)) }
    catch (error) {
      if (signal?.aborted) throw error
      client.clear()
      if (error instanceof AuthError && error.code === 'SESSION_EXPIRED') return null
      throw error
    }
  },
  signOut: () => client.logout(),
}
