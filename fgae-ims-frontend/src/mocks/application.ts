import { authService } from './auth'
import { readWorkflow } from './correction-store'
import { readOwnApplication } from './credentials'
import { ApplicationError, canReadOwnApplication, mapOwnApplication, type ApplicationService, type OwnApplication } from '../services/contracts/application'
import type { Identity } from '../services/contracts/auth'

function fixture(identity: Identity): OwnApplication | null {
  if (!['pending@example.test', 'volunteer@example.test', 'multi.role@example.test'].includes(identity.email)) return null
  const submittedAt = '2026-11-09T08:00:00.000Z'
  const approved = identity.accountState === 'ACTIVE'
  const updatedAt = approved ? '2026-11-10T08:00:00.000Z' : submittedAt
  return {
    id: `synthetic-application-${identity.id}`, ownerId: identity.id, status: approved ? 'APPROVED' : 'PENDING', submittedAt, updatedAt,
    fields: { fullName: identity.name, email: identity.email, phone: '', birthDate: '', gender: '', branchId: 'fictional-branch-a' },
    branchName: 'Demo branch A', documents: [], history: [
      { id: 'submitted', status: 'PENDING', at: submittedAt, note: '' },
      ...(approved ? [{ id: 'approved', status: 'APPROVED' as const, at: updatedAt, note: '' }] : []),
    ],
  }
}
export const applicationService: ApplicationService = {
  async own(signal) {
    const identity = await authService.restore(signal)
    if (!identity) throw new ApplicationError('SESSION_EXPIRED')
    if (!canReadOwnApplication(identity)) throw new ApplicationError('FORBIDDEN')
    const stored = readOwnApplication(identity.id)
    const application: OwnApplication | null = readWorkflow(identity.id)?.application ?? (stored ? {
      id: stored.receipt.id, ownerId: identity.id, status: 'PENDING', submittedAt: stored.receipt.submittedAt, updatedAt: stored.receipt.submittedAt,
      fields: stored.fields, documents: stored.documents, branchName: stored.fields.branchId === 'fictional-branch-a' ? 'Demo branch A' : stored.fields.branchId === 'fictional-branch-b' ? 'Demo branch B' : stored.fields.branchId,
      history: [{ id: `${stored.receipt.id}-submitted`, status: 'PENDING', at: stored.receipt.submittedAt, note: '' }],
    } : fixture(identity))
    signal?.throwIfAborted()
    return { identity, application: mapOwnApplication(application, identity.id) }
  },
}
