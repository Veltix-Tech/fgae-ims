import { AuthError, type AuthErrorCode } from '../contracts/auth'
import { envelope } from '../adapters/auth-dto'

const knownErrors = new Set<AuthErrorCode>(['INVALID_CREDENTIALS', 'INACTIVE_ACCOUNT', 'NETWORK',
  'UNAVAILABLE', 'RATE_LIMITED', 'SESSION_EXPIRED'])
export class AuthClient {
  private accessToken: string | null = null
  private renewal: Promise<void> | null = null
  private generation = 0
  constructor(private readonly baseUrl: string, private readonly fetcher: typeof fetch = fetch) {}

  clear() { this.generation++; this.accessToken = null }
  private setToken(data: Record<string, unknown>, generation: number) {
    if (generation !== this.generation) throw new AuthError('SESSION_EXPIRED')
    if (typeof data.access_token !== 'string' || !data.access_token) throw new AuthError('INVALID_RESPONSE')
    this.accessToken = data.access_token
  }
  private async request(path: string, method: string, body?: unknown, signal?: AbortSignal) {
    try {
      const fetcher = this.fetcher
      return await fetcher(`${this.baseUrl}${path}`, {
        method, credentials: 'include', signal,
        headers: { ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      throw new AuthError('NETWORK')
    }
  }
  private async parse(response: Response) {
    if (!response.ok) {
      let code: unknown
      try { code = ((await response.json()) as { code?: unknown }).code } catch { /* Non-JSON errors use HTTP fallback. */ }
      if (knownErrors.has(code as AuthErrorCode)) throw new AuthError(code as AuthErrorCode)
      throw new AuthError(response.status === 401 ? 'SESSION_EXPIRED' :
        response.status === 429 ? 'RATE_LIMITED' : 'UNAVAILABLE')
    }
    try { return envelope(await response.json()) }
    catch (error) { if (error instanceof AuthError) throw error; throw new AuthError('INVALID_RESPONSE') }
  }
  async login(credentials: { email: string; password: string }, signal?: AbortSignal) {
    this.clear()
    const generation = this.generation
    const response = await this.request('/auth/login', 'POST', credentials, signal)
    if (response.status === 401) throw new AuthError('INVALID_CREDENTIALS')
    this.setToken(await this.parse(response), generation)
  }
  async refresh() {
    if (!this.renewal) {
      const generation = this.generation
      this.renewal = this.request('/auth/refresh', 'POST').then(r => this.parse(r))
        .then(data => this.setToken(data, generation))
        .catch(error => { if (generation === this.generation) this.clear(); throw error })
        .finally(() => { this.renewal = null })
    }
    return this.renewal
  }
  async me(signal?: AbortSignal) {
    const generation = this.generation
    let response = await this.request('/auth/me', 'GET', undefined, signal)
    if (response.status === 401) {
      await this.refresh()
      response = await this.request('/auth/me', 'GET', undefined, signal)
    }
    if (generation !== this.generation) throw new AuthError('SESSION_EXPIRED')
    try { return await this.parse(response) } catch (error) {
      if (error instanceof AuthError && error.code === 'SESSION_EXPIRED') this.clear()
      throw error
    }
  }
  async logout() {
    // C-AUTH-04 is proposed: backend must revoke its refresh cookie, not just the memory token.
    try { await this.parse(await this.request('/auth/logout', 'POST')) }
    finally { this.clear() }
  }
}
