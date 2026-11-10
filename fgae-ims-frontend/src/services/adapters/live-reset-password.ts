import { ResetError, type ResetErrorCode, type ResetPasswordService, validNewPassword } from '../contracts/reset-password'

const knownCodes = new Set<ResetErrorCode>(['INVALID_LINK', 'EXPIRED_LINK', 'USED_LINK', 'RATE_LIMITED',
  'PASSWORD_REJECTED', 'SAME_PASSWORD', 'CONFIRMATION_MISMATCH'])
async function request(path: string, body: object, signal?: AbortSignal, idempotencyKey?: string) {
  let response: Response
  try {
    response = await fetch(`${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')}${path}`, {
      method: 'POST', credentials: 'omit', signal, cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
      body: JSON.stringify(body),
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new ResetError('NETWORK')
  }
  let result: { success?: boolean; code?: ResetErrorCode; data?: { valid?: boolean; expires_at?: string; completed?: boolean } }
  try { result = await response.json() as typeof result } catch { throw new ResetError('UNAVAILABLE') }
  signal?.throwIfAborted()
  if (!response.ok) throw new ResetError(result?.code && knownCodes.has(result.code) ? result.code :
    response.status === 429 ? 'RATE_LIMITED' : 'UNAVAILABLE')
  if (result?.success !== true || !result.data) throw new ResetError('UNAVAILABLE')
  return result.data
}
export const resetPasswordService: ResetPasswordService = {
  async validate(token, signal) {
    if (!token || token.length > 2048) throw new ResetError('INVALID_LINK')
    // C-AUTH-06/07 are proposed. Tokens only travel in POST bodies, never query strings.
    const data = await request('/auth/reset-password/validate', { token }, signal)
    const expiresAt = typeof data.expires_at === 'string' ? Date.parse(data.expires_at) : NaN
    if (data.valid !== true || !Number.isFinite(expiresAt)) throw new ResetError('UNAVAILABLE')
    if (expiresAt <= Date.now()) throw new ResetError('EXPIRED_LINK')
    return { expiresAt }
  },
  async complete(input, signal) {
    if (!validNewPassword(input.password)) throw new ResetError('PASSWORD_REJECTED')
    if (input.password !== input.confirmation) throw new ResetError('CONFIRMATION_MISMATCH')
    const data = await request('/auth/reset-password', {
      token: input.token, password: input.password, password_confirmation: input.confirmation,
    }, signal, input.idempotencyKey)
    if (data.completed !== true) throw new ResetError('UNAVAILABLE')
  },
}
