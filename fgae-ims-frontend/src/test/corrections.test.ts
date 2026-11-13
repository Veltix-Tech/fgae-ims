import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { File as NodeFile } from 'node:buffer'
import { authService } from '../mocks/auth'
import { correctionService } from '../mocks/corrections'
import { applicationService } from '../mocks/application'
import { readWorkflow } from '../mocks/correction-store'
import { canCorrect, mapCorrectionContext, validateCorrection, type CorrectionContext, type CorrectionInput } from '../services/contracts/corrections'
import { AuthClient } from '../services/http/auth-client'
import { accounts } from '../mocks/identities'
const storage = vi.hoisted(() => new Map<string, unknown>())
vi.mock('../mocks/registration-store', () => ({
  readRegistrationItem: vi.fn(async (key: string) => storage.get(key) ?? null),
  writeRegistrationItem: vi.fn(async (key: string, value: unknown, signal?: AbortSignal) => { signal?.throwIfAborted(); storage.set(key, value) }),
  updateDraft: vi.fn(),
}))
beforeAll(() => { vi.stubGlobal('crypto', webcrypto); vi.stubGlobal('File', NodeFile) })
afterAll(() => vi.unstubAllGlobals())
beforeEach(() => storage.clear())
const signIn = () => authService.signIn({ email: 'returned@example.test', password: 'Demo-only-2026!' })
function input(context: CorrectionContext): CorrectionInput { return { fields: { ...context.application.fields, phone: '0912345678' }, documents: [], applicationId: context.application.id, revision: context.revision, draftVersion: context.draftVersion, configVersion: context.config.version } }
async function withDocument(context: CorrectionContext) {
  const file = new NodeFile(['%PDF-1.7\nfictional'], 'proof.pdf', { type: 'application/pdf' }) as unknown as File
  const document = await correctionService.upload(file, 'identity', new AbortController().signal, () => {})
  return { ...input(context), documents: [document] }
}
describe('own returned application corrections', () => {
  it('requires a session, a pending identity and an actually returned record', async () => {
    await expect(correctionService.load()).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
    for (const identity of accounts) expect(canCorrect(identity)).toBe(identity.accountState === 'PENDING' && !identity.mustChangePassword)
    await authService.signIn({ email: 'volunteer@example.test', password: 'Demo-only-2026!' })
    await expect(correctionService.load()).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await authService.signIn({ email: 'pending@example.test', password: 'Demo-only-2026!' })
    await expect(correctionService.load()).rejects.toMatchObject({ code: 'NOT_RETURNED' })
  })
  it('maps only owned returned context, excludes internal receipts, and rejects unsafe configuration', async () => {
    await signIn(); const value = await correctionService.load()
    expect(value).not.toHaveProperty('receipts')
    expect(() => mapCorrectionContext(value, 'another-owner')).toThrow()
    for (const change of [{ revision: 0 }, { editableFields: ['email'] }, { documentTypes: ['unknown'] }, { draft: {} }, { config: {} }]) expect(() => mapCorrectionContext({ ...value, ...change }, value.application.ownerId)).toThrow()
  })
  it('allows incomplete drafts but prevents unrequested field edits, email changes and forged documents', async () => {
    await signIn(); const context = await correctionService.load(); const value = input(context)
    expect(() => validateCorrection({ ...value, fields: { ...value.fields, phone: 'bad' } }, context)).not.toThrow()
    for (const key of ['email', 'fullName'] as const) await expect(correctionService.save({ ...value, fields: { ...value.fields, [key]: 'Changed' } })).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(correctionService.save({ ...value, applicationId: 'other' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(correctionService.save({ ...value, documents: [{ id: 'forged', typeId: 'identity', name: 'proof.pdf', mime: 'application/pdf', size: 10 }] })).rejects.toMatchObject({ code: 'DOCUMENT_MISSING' })
  })
  it('persists drafts without submitting, detects conflicts and keeps monotonic versions after delete', async () => {
    await signIn(); const context = await correctionService.load(); const value = input(context)
    const results = await Promise.allSettled([correctionService.save(value), correctionService.save(value)])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.find(result => result.status === 'rejected')).toMatchObject({ reason: { code: 'DRAFT_CONFLICT' } })
    const restored = await correctionService.load(); expect(restored.draft?.fields.phone).toBe(value.fields.phone)
    expect((await applicationService.own()).application?.fields.phone).toBe(context.application.fields.phone)
    await correctionService.discard({ ...value, draftVersion: restored.draftVersion })
    const deleted = await correctionService.load(); expect(deleted.draft).toBeNull(); expect(deleted.draftVersion).toBe(2)
    await expect(correctionService.save(value)).rejects.toMatchObject({ code: 'DRAFT_CONFLICT' })
  })
  it('validates missing documents and fields before resubmission', async () => {
    await signIn(); const context = await correctionService.load(); const value = { ...input(context), confirmed: true, idempotencyKey: 'new' }
    await expect(correctionService.submit(value)).rejects.toMatchObject({ code: 'DOCUMENT_MISSING' })
    await expect(correctionService.submit({ ...value, fields: { ...value.fields, phone: 'bad' } })).rejects.toMatchObject({ code: 'VALIDATION', fields: { phone: 'regPhoneInvalid' } })
    await expect(correctionService.save({ ...value, revision: 1 })).rejects.toMatchObject({ code: 'REVISION_CONFLICT' })
    await expect(correctionService.save({ ...value, configVersion: 'old' })).rejects.toMatchObject({ code: 'CONFIG_CHANGED' })
  })
  it('resubmits once, retains decisions and previous values, clears draft and grants no access', async () => {
    await signIn(); const context = await correctionService.load(); const value = await withDocument(context)
    const saved = await correctionService.save(value)
    const payload = { ...value, draftVersion: saved.version, confirmed: true, idempotencyKey: 'one-intent' }
    const results = await Promise.all([correctionService.submit(payload), correctionService.submit(payload)])
    expect(results[0]).toEqual(results[1])
    const result = await applicationService.own()
    expect(result.application?.status).toBe('PENDING'); expect(result.identity.grants).toEqual([])
    expect(result.application?.history).toHaveLength(3)
    expect(result.application?.history.slice(0, 2)).toEqual(context.application.history)
    expect(result.application?.fields.phone).toBe('+251912345678')
    const workflow = readWorkflow(context.application.ownerId)!
    expect(workflow.draft).toBeNull(); expect(workflow.versions?.[0]?.fields).toEqual(context.application.fields)
    await expect(correctionService.load()).rejects.toMatchObject({ code: 'NOT_RETURNED' })
    await expect(correctionService.submit({ ...payload, fields: { ...payload.fields, phone: '+251933333333' } })).rejects.toMatchObject({ code: 'VALIDATION' })
  })
  it('checks upload type, cancellation, document ownership and session expiry', async () => {
    await signIn(); const context = await correctionService.load()
    await expect(correctionService.upload(new NodeFile(['bad'], 'x.pdf', { type: 'application/pdf' }) as unknown as File, 'identity', new AbortController().signal, () => {})).rejects.toMatchObject({ code: 'FILE_TYPE' })
    const value = await withDocument(context)
    expect((await correctionService.preview(value.documents[0]!.id, new AbortController().signal)).size).toBeGreaterThan(0)
    await expect(correctionService.preview('unowned-file', new AbortController().signal)).rejects.toMatchObject({ code: 'DOCUMENT_MISSING' })
    const controller = new AbortController(); controller.abort()
    await expect(correctionService.save(value, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    const key = 'fgae.synthetic.auth.v1'; sessionStorage.setItem(key, JSON.stringify({ ...JSON.parse(sessionStorage.getItem(key)!), expiresAt: 0 }))
    await expect(correctionService.save(value)).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
    expect(readWorkflow(context.application.ownerId)?.draft).toBeNull()
  })
  it('does not let unchanged metadata bypass missing original file checks or locked-document rules', async () => {
    await signIn(); const context = await correctionService.load(); const value = await withDocument(context)
    const workflow = readWorkflow(context.application.ownerId)!
    workflow.application.documents = value.documents
    workflow.documentTypes = []
    localStorage.setItem('fgae.synthetic.corrections.v1', JSON.stringify({ [context.application.ownerId]: workflow }))
    await expect(correctionService.save({ ...value, documents: [] })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    storage.clear()
    await expect(correctionService.save(value)).rejects.toMatchObject({ code: 'DOCUMENT_MISSING' })
  })
  it('does not overwrite a newer reviewer decision or allow stale draft revisions', async () => {
    await signIn(); const context = await correctionService.load(); const value = input(context)
    const workflow = readWorkflow(context.application.ownerId)!
    workflow.revision++
    localStorage.setItem('fgae.synthetic.corrections.v1', JSON.stringify({ [context.application.ownerId]: workflow }))
    await expect(correctionService.save(value)).rejects.toMatchObject({ code: 'REVISION_CONFLICT' })
    workflow.application.status = 'REJECTED'
    workflow.application.history.push({ id: 'rejected', status: 'REJECTED', at: workflow.application.updatedAt, note: 'A later review decision.' })
    localStorage.setItem('fgae.synthetic.corrections.v1', JSON.stringify({ [context.application.ownerId]: workflow }))
    await expect(correctionService.submit({ ...value, confirmed: true, idempotencyKey: 'stale' })).rejects.toMatchObject({ code: 'NOT_RETURNED' })
    expect(readWorkflow(context.application.ownerId)?.application.status).toBe('REJECTED')
  })
})
describe('correction authenticated transport', () => {
  const json = (data: unknown, status = 200) => new Response(JSON.stringify({ success: true, data }), { status })
  it('renews once and preserves method, bearer, credentials, payload and idempotency key', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(json({ access_token: 'new-token' })).mockResolvedValueOnce(json({ status: 'PENDING' }))
    const client = new AuthClient('https://api.invalid', fetcher)
    await expect(client.correction('/resubmit', 'POST', { revision: 2 }, undefined, { key: 'same-intent' })).resolves.toEqual({ status: 'PENDING' })
    expect(fetcher.mock.calls[2]![1]).toMatchObject({ method: 'POST', credentials: 'include', cache: 'no-store', body: JSON.stringify({ revision: 2 }), headers: { Authorization: 'Bearer new-token', 'Idempotency-Key': 'same-intent' } })
  })
  it('maps version/validation/access errors safely and rejects stale completion', async () => {
    for (const [status, code] of [[403, 'FORBIDDEN'], [409, 'REVISION_CONFLICT'], [429, 'RATE_LIMITED'], [503, 'UNAVAILABLE']] as const) await expect(new AuthClient('', vi.fn().mockResolvedValue(json({}, status))).correction('/draft', 'PUT', {})).rejects.toMatchObject({ code })
    const response = new Response(JSON.stringify({ code: 'VALIDATION', fields: { phone: 'INVALID_PHONE', email: 'RAW_SECRET', secret: 'REQUIRED' } }), { status: 422 })
    await expect(new AuthClient('', vi.fn().mockResolvedValue(response)).correction('/draft', 'PUT', {})).rejects.toMatchObject({ code: 'VALIDATION', fields: { phone: 'regPhoneInvalid' } })
    let finish!: (response: Response) => void
    const client = new AuthClient('', vi.fn(() => new Promise<Response>(resolve => { finish = resolve })))
    const request = client.correction('/resubmit', 'POST', {}); client.clear(); finish(json({ status: 'PENDING' }))
    await expect(request).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
  })
})
