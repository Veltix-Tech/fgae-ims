import { authService } from './auth'
import { allowanceRecords, budgetRecords, participantAssignments, participantAttendance, paymentRecords } from './participant-records'
import { canReadParticipant, canReadParticipantRow, isGlobalAdmin, mapParticipantOverview, type ParticipantOverviewService } from '../services/contracts/participant-overview'
import { ManagerError } from '../services/contracts/manager-overview'
export const participantOverviewService: ParticipantOverviewService = {
  async load(kind, signal) {
    const identity = await authService.restore(signal)
    if (!identity) throw new ManagerError('SESSION_EXPIRED')
    if (!canReadParticipant(identity, kind)) throw new ManagerError('FORBIDDEN')
    const assignments = kind === 'finance-officer' ? [] : participantAssignments().filter(row => canReadParticipantRow(identity, kind, row))
    signal?.throwIfAborted()
    return { identity, overview: mapParticipantOverview({ ownerId: identity.id, kind, complete: true, generatedAt: new Date().toISOString(),
      // Demo finance account has both capabilities; real capability grants come from the backend.
      capabilities: { approve: kind === 'finance-officer' && (identity.id === 'fictional-person-6' || isGlobalAdmin(identity)), disburse: kind === 'finance-officer' && (identity.id === 'fictional-person-6' || isGlobalAdmin(identity)) }, assignments,
      attendance: participantAttendance().filter(row => assignments.some(item => item.id === row.assignmentId)),
      allowances: allowanceRecords.filter(row => canReadParticipantRow(identity, kind, row)).map(row => ({ ...row, amountMinor: kind === 'field-supervisor' ? null : row.amountMinor })),
      payments: kind === 'field-supervisor' ? [] : paymentRecords.filter(row => canReadParticipantRow(identity, kind, row)),
      budgets: kind === 'finance-officer' ? budgetRecords.filter(row => canReadParticipantRow(identity, kind, row)) : [],
    }, identity, kind) }
  },
}
