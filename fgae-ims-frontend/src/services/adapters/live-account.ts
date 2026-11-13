import { authService, client } from './live-auth'
import { AccountError, canManageAccount, mapAccountProfile, photoRule, type AccountService } from '../contracts/account'
import type { RegistrationDocument } from '../contracts/registration'
async function owner(signal?: AbortSignal) {
  const identity = await authService.restore(signal)
  if (!identity) throw new AccountError('SESSION_EXPIRED')
  if (!canManageAccount(identity)) throw new AccountError('FORBIDDEN')
  return identity
}
export const accountService: AccountService = {
  async load(signal) { const identity = await owner(signal); const data = await client.accountRequest('', 'GET', undefined, signal) as { profile: unknown }; return { identity, profile: mapAccountProfile(data.profile, identity.id) } },
  async save(input, signal) {
    const identity = await owner(signal)
    if (identity.id !== input.ownerId) throw new AccountError('FORBIDDEN')
    const { ownerId, version, name, phone, locale, photo } = input
    const profile = mapAccountProfile(await client.accountRequest('', 'PUT', { ownerId, version, name, phone, locale, photo }, signal), identity.id)
    if (profile.version !== input.version + 1) throw new AccountError('UNAVAILABLE')
    return profile
  },
  async upload(file, typeId, signal, progress) {
    await owner(signal)
    if (typeId !== 'photo') throw new AccountError('FILE_TYPE')
    const body = new FormData(); body.append('file', file)
    const value = await client.accountRequest('/photos', 'POST', body, signal, { progress }) as unknown as RegistrationDocument
    if (!value || typeof value.id !== 'string' || !value.id || value.typeId !== 'photo' || value.name !== file.name || value.mime !== file.type || value.size !== file.size) throw new AccountError('UNAVAILABLE')
    return value
  },
  async preview(id, signal) { await owner(signal); const blob = await client.accountRequest(`/photos/${encodeURIComponent(id)}/content`, 'GET', undefined, signal, { blob: true }) as Blob; if (!photoRule.types.includes(blob.type)) throw new AccountError('FILE_TYPE'); return blob },
  async password(input, signal) {
    const data = await client.accountRequest('/password', 'POST', { current_password: input.currentPassword, password: input.password, password_confirmation: input.confirmation }, signal, { key: input.idempotencyKey }) as { completed?: boolean }
    if (data.completed !== true) throw new AccountError('UNAVAILABLE')
    client.clear()
  },
}
