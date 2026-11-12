import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { File as NodeFile } from 'node:buffer'
import { personalErrors, normalizePhone, validateDocument, validateRegistration, type RegistrationInput } from '../services/contracts/registration'
import { registrationConfig } from '../mocks/registration'
import { registerApplicant, findAccount } from '../mocks/credentials'
import { authService } from '../mocks/auth'
import { hasGrant, nextJourney } from '../permissions/session-policy'
import { registrationService as live } from '../services/adapters/live-registration'
import { recoveryService } from '../mocks/recovery'
import { resetPasswordService } from '../mocks/reset-password'
beforeAll(() => vi.stubGlobal('crypto', webcrypto))
afterAll(() => vi.unstubAllGlobals())
const password = 'A fictional applicant phrase'
const fields = { fullName: 'ሐና አበበ', email: 'new.applicant@example.test', phone: '0912 345 678', gender: 'FEMALE', birthDate: '2000-02-29', branchId: 'fictional-branch-a' }
const input: RegistrationInput = { fields, documents: [{ id: 'file-a', typeId: 'identity', name: 'proof.pdf', size: 12, mime: 'application/pdf' }], password, confirmation: password, confirmed: true, configVersion: registrationConfig.version, idempotencyKey: 'application-a' }
describe('registration validation and pending account continuity', () => {
  it('supports Ethiopic names and Ethiopian/international phone formats with valid Gregorian dates', () => {
    expect(personalErrors(fields, registrationConfig)).toEqual({})
    expect(normalizePhone(fields.phone)).toBe('+251912345678')
    expect(normalizePhone('0712-345-678')).toBe('+251712345678')
    expect(personalErrors({ ...fields, phone: '+1 (202) 555-0123' }, registrationConfig)).toEqual({})
    expect(personalErrors({ ...fields, birthDate: '2025-02-29', email: 'bad', phone: '123', branchId: 'missing' }, registrationConfig)).toMatchObject({ birthDate: 'regDateInvalid', email: 'regEmailInvalid', phone: 'regPhoneInvalid', branchId: 'regBranchInvalid' })
    expect(personalErrors({ ...fields, birthDate: '2999-01-01' }, registrationConfig)).toHaveProperty('birthDate')
  })
  it('requires configured documents, confirmation and current config', () => {
    expect(() => validateRegistration(input, registrationConfig)).not.toThrow()
    expect(() => validateRegistration({ ...input, documents: [] }, registrationConfig)).toThrow('DOCUMENT_MISSING')
    expect(() => validateRegistration({ ...input, configVersion: 'old' }, registrationConfig)).toThrow('CONFIG_CHANGED')
    expect(() => validateRegistration({ ...input, confirmed: false }, registrationConfig)).toThrow('VALIDATION')
    expect(() => validateRegistration({ ...input, confirmation: 'mismatch' }, registrationConfig)).toThrow('VALIDATION')
  })
  it('rejects wrong MIME, disguised content, empty and oversized uploads', async () => {
    const rule = registrationConfig.documents[0]!
    await expect(validateDocument(new NodeFile(['%PDF-1.7'], 'proof.pdf', { type: 'application/pdf' }) as unknown as File, rule)).resolves.toBeUndefined()
    for (const file of [new NodeFile(['html'], 'proof.pdf', { type: 'application/pdf' }), new NodeFile(['x'], 'proof.svg', { type: 'image/svg+xml' }), new NodeFile([], 'proof.png', { type: 'image/png' })]) {
      await expect(validateDocument(file as unknown as File, rule)).rejects.toThrow()
    }
    await expect(validateDocument(new NodeFile(['%PDF-1.7'], 'proof.pdf', { type: 'application/pdf' }) as unknown as File, { ...rule, maxBytes: 2 })).rejects.toMatchObject({ code: 'FILE_SIZE' })
  })
  it('persists a pending identity and password verifier without operational grants or plaintext', async () => {
    const receipt = await registerApplicant(input)
    expect(receipt.status).toBe('PENDING')
    const identity = await authService.signIn({ email: fields.email, password })
    expect(identity.name).toBe(fields.fullName)
    expect(identity.grants).toEqual([])
    expect(nextJourney(identity)).toBe('application')
    expect(hasGrant(identity, 'VOLUNTEER', { kind: 'self', id: identity.id })).toBe(false)
    expect(await authService.restore()).toEqual(identity)
    expect(findAccount(fields.email)).toEqual(identity)
    expect(JSON.stringify(localStorage)).not.toContain(password)
    expect(JSON.stringify(sessionStorage)).not.toContain(password)
  })
  it('deduplicates identical requests and rejects conflicting keys and case-insensitive duplicate emails', async () => {
    const result = await Promise.allSettled([registerApplicant(input), registerApplicant({ ...input, idempotencyKey: 'competing', fields: { ...fields, email: fields.email.toUpperCase() } })])
    expect(result.filter(item => item.status === 'fulfilled')).toHaveLength(1)
    const first = await registerApplicant(input)
    expect(await registerApplicant(input)).toEqual(first)
    await expect(registerApplicant({ ...input, fields: { ...fields, fullName: 'Different applicant' } })).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(registerApplicant({ ...input, idempotencyKey: 'existing', fields: { ...fields, email: 'volunteer@example.test' } })).rejects.toMatchObject({ code: 'EMAIL_IN_USE' })
  })
  it('does not create an account after cancellation', async () => {
    const controller = new AbortController(); controller.abort()
    await expect(registerApplicant(input, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(findAccount(fields.email)).toBeUndefined()
  })
  it('keeps a registered account pending through later password recovery', async () => {
    await registerApplicant(input)
    await recoveryService.request({ email: fields.email, locale: 'en', idempotencyKey: 'new-applicant-recovery' })
    const newPassword = 'Another fictional applicant phrase'
    await resetPasswordService.complete({ token: 'synthetic-reset-new-applicant-recovery', password: newPassword, confirmation: newPassword, idempotencyKey: 'new-applicant-reset' })
    const identity = await authService.signIn({ email: fields.email, password: newPassword })
    expect(identity.accountState).toBe('PENDING')
    expect(identity.grants).toEqual([])
  })
})
describe('registration proposed live contract', () => {
  it('validates config/receipt, sends documented application endpoint with idempotency and no mock fallback', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch')
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: registrationConfig })))
    expect(await live.config()).toEqual(registrationConfig)
    const receipt = { id: 'live-reference', email: fields.email, submittedAt: new Date().toISOString(), status: 'PENDING' }
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: receipt })))
    expect(await live.submit(input)).toEqual(receipt)
    expect(fetcher).toHaveBeenLastCalledWith('/volunteers/applications', expect.objectContaining({ method: 'POST', credentials: 'include', headers: expect.objectContaining({ 'Idempotency-Key': input.idempotencyKey }) }))
    expect(live.receipt()).toEqual(receipt)
    expect(localStorage.length).toBe(0)
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ code: 'EMAIL_IN_USE' }), { status: 409 }))
    await expect(live.submit(input)).rejects.toMatchObject({ code: 'EMAIL_IN_USE' })
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { ...receipt, status: 'ACTIVE' } })))
    await expect(live.submit(input)).rejects.toMatchObject({ code: 'UNAVAILABLE' })
    fetcher.mockResolvedValueOnce(new Response('', { status: 429 }))
    await expect(live.config()).rejects.toMatchObject({ code: 'RATE_LIMITED' })
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ code: 'VALIDATION', fields: { phone: 'INVALID_PHONE', email: 'raw internal message', password: 'REQUIRED' } }), { status: 422 }))
    await expect(live.submit(input)).rejects.toMatchObject({ code: 'VALIDATION', fields: { phone: 'regPhoneInvalid' } })
  })
})
