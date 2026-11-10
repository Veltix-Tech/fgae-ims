import { describe, expect, it, vi } from 'vitest'
import { recoveryService as mockService } from '../mocks/recovery'
import { recoveryService as liveService } from '../services/adapters/live-recovery'
import { roles } from '../services/contracts/auth'

const input = { email: 'volunteer@example.test', locale: 'en' as const, idempotencyKey: 'request-one' }
describe('recovery service', () => {
  it.each([...roles.map(role => `${role.toLowerCase().replaceAll('_', '.')}@example.test`), 'unknown@example.test', 'pending@example.test', 'inactive@example.test'])('accepts %s without exposing account existence', async email => {
    const result = await mockService.request({ ...input, email })
    expect(result.email).toBe(email)
    expect(result.retryAt - result.acceptedAt).toBe(60_000)
    expect(mockService.restoreReceipt()).toEqual(result)
    expect(JSON.parse(sessionStorage.getItem('fgae.synthetic.recovery.requests.v1')!).requests).toHaveLength(1)
  })
  it('deduplicates retries and retains cooldown even after clearing confirmation', async () => {
    const first = await mockService.request(input)
    expect(await mockService.request(input)).toEqual(first)
    expect(JSON.parse(sessionStorage.getItem('fgae.synthetic.recovery.requests.v1')!).requests).toHaveLength(1)
    mockService.clearReceipt()
    expect(mockService.restoreReceipt()).toBeNull()
    await expect(mockService.request({ ...input, idempotencyKey: 'another' })).rejects.toMatchObject({ code: 'RATE_LIMITED' })
  })
  it('validates, cancels without recording and permits resend after cooldown', async () => {
    await expect(mockService.request({ ...input, email: 'invalid' })).rejects.toMatchObject({ code: 'INVALID_EMAIL' })
    const controller = new AbortController(); controller.abort()
    await expect(mockService.request(input, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(sessionStorage.getItem('fgae.synthetic.recovery.requests.v1')).toBeNull()
    const result = await mockService.request(input)
    const clock = vi.spyOn(Date, 'now').mockReturnValue(result.retryAt + 1)
    await mockService.request({ ...input, idempotencyKey: 'second' })
    expect(JSON.parse(sessionStorage.getItem('fgae.synthetic.recovery.requests.v1')!).requests).toHaveLength(2)
    clock.mockRestore()
  })
  it('sends the proposed live contract and handles errors without synthetic fallback', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { accepted: true, retry_after_seconds: 60 } }), { status: 202 }))
    expect((await liveService.request(input)).email).toBe(input.email)
    expect(fetcher).toHaveBeenCalledWith('/auth/forgot-password', expect.objectContaining({ method: 'POST', credentials: 'omit', headers: expect.objectContaining({ 'Idempotency-Key': 'request-one' }), body: JSON.stringify({ email: input.email, locale: 'en' }) }))
    fetcher.mockResolvedValueOnce(new Response('{}', { status: 429, headers: { 'Retry-After': '30' } }))
    await expect(liveService.request(input)).rejects.toMatchObject({ code: 'RATE_LIMITED', retryAfterSeconds: 30 })
    fetcher.mockResolvedValueOnce(new Response('{}', { status: 503 }))
    await expect(liveService.request(input)).rejects.toMatchObject({ code: 'UNAVAILABLE' })
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { accepted: false } })))
    await expect(liveService.request(input)).rejects.toMatchObject({ code: 'UNAVAILABLE' })
    fetcher.mockRejectedValueOnce(new TypeError('offline'))
    await expect(liveService.request(input)).rejects.toMatchObject({ code: 'NETWORK' })
    expect(sessionStorage.getItem('fgae.synthetic.recovery.requests.v1')).toBeNull()
  })
})
