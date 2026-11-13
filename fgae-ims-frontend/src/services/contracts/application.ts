import type { Identity } from './auth'
import type { RegistrationDocument, RegistrationFields } from './registration'

export const applicationStatuses = ['PENDING', 'RETURNED', 'APPROVED', 'REJECTED'] as const
export type ApplicationStatus = typeof applicationStatuses[number]
export interface ApplicationEvent { id: string; status: ApplicationStatus; at: string; note: string }
export interface OwnApplication {
  id: string; ownerId: string; status: ApplicationStatus; submittedAt: string; updatedAt: string
  fields: RegistrationFields; branchName: string; documents: RegistrationDocument[]; history: ApplicationEvent[]
}
export interface ApplicationSnapshot { identity: Identity; application: OwnApplication | null }
export type ApplicationErrorCode = 'SESSION_EXPIRED' | 'FORBIDDEN' | 'NETWORK' | 'UNAVAILABLE' | 'INVALID_RESPONSE' | 'RATE_LIMITED' | 'STORAGE_UNAVAILABLE'
export class ApplicationError extends Error {
  constructor(public readonly code: ApplicationErrorCode) { super(code); this.name = 'ApplicationError' }
}
export interface ApplicationService { own(signal?: AbortSignal): Promise<ApplicationSnapshot> }
export function canReadOwnApplication(identity: Identity): boolean {
  return !identity.mustChangePassword && (identity.accountState === 'PENDING' || identity.grants.some(grant => grant.role === 'VOLUNTEER' && grant.scope.kind === 'self' && grant.scope.id === identity.id))
}
// Strict boundary: never display another owner's data or infer an unknown status.
export function mapOwnApplication(value: unknown, ownerId: string): OwnApplication | null {
  if (value === null) return null
  const invalid = () => { throw new ApplicationError('INVALID_RESPONSE') }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  const data = value as OwnApplication
  const string = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
  const date = (v: unknown): v is string => string(v) && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v))
  const status = (v: unknown) => applicationStatuses.includes(v as ApplicationStatus)
  if (!string(data.id) || data.ownerId !== ownerId || !status(data.status) || !date(data.submittedAt) || !date(data.updatedAt) || Date.parse(data.updatedAt) < Date.parse(data.submittedAt) || typeof data.branchName !== 'string') return invalid()
  if (!data.fields || !['fullName', 'email', 'phone', 'birthDate', 'gender', 'branchId'].every(key => typeof data.fields[key as keyof RegistrationFields] === 'string')) return invalid()
  if (data.fields.birthDate && (!/^\d{4}-\d{2}-\d{2}$/.test(data.fields.birthDate) || !Number.isFinite(Date.parse(data.fields.birthDate)) || new Date(data.fields.birthDate).toISOString().slice(0, 10) !== data.fields.birthDate)) return invalid()
  if (!['', 'FEMALE', 'MALE', 'OTHER', 'UNDISCLOSED'].includes(data.fields.gender)) return invalid()
  if (!Array.isArray(data.documents) || data.documents.some(doc => !doc || !string(doc.id) || !string(doc.typeId) || !string(doc.name) || !['application/pdf', 'image/png', 'image/jpeg'].includes(doc.mime) || !Number.isFinite(doc.size) || doc.size <= 0)) return invalid()
  if (new Set(data.documents.map(doc => doc.id)).size !== data.documents.length) return invalid()
  if (!Array.isArray(data.history) || !data.history.length || data.history.some(event => !event || !string(event.id) || !status(event.status) || !date(event.at) || typeof event.note !== 'string')) return invalid()
  if (data.history.some(event => ['RETURNED', 'REJECTED'].includes(event.status) && !event.note.trim())) return invalid()
  if (new Set(data.history.map(event => event.id)).size !== data.history.length || data.history[0]!.status !== 'PENDING' || data.history[0]!.at !== data.submittedAt) return invalid()
  if (data.history.some((event, i) => Date.parse(event.at) > Date.parse(data.updatedAt) || i > 0 && Date.parse(event.at) < Date.parse(data.history[i - 1]!.at)) || data.history.at(-1)!.status !== data.status) return invalid()
  return data
}
