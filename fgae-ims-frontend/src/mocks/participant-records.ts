import type { AllowanceSummary, AssignmentSummary, AttendanceSummary, BudgetSummary, PaymentSummary } from '../services/contracts/participant-overview'
import { allocations, assignments, attendance, readWorkLocations } from './operations'
import { accounts } from './identities'
const placement = { branchId: 'fictional-branch-a', areaId: 'fictional-area-a', projectId: 'fictional-project-a' }
export function participantAssignments(): AssignmentSummary[] {
  return assignments.map(row => {
    const work = allocations.find(item => item.id === row.workId)!
    const endAt = work.dueAt
    return { ...placement, id: row.id, title: work.title, place: readWorkLocations().find(item => item.id === work.branchId)!.name, volunteerId: row.volunteerId, volunteerName: accounts.find(person => person.id === row.volunteerId)!.name, supervisorId: row.supervisorId,
      startAt: work.state === 'COMPLETED' ? endAt.replace('14:00:00', '06:00:00') : '2026-11-17T06:00:00Z', endAt, state: work.state === 'COMPLETED' ? 'ENDED' : 'ACTIVE' }
  })
}
export function participantAttendance(): AttendanceSummary[] {
  const work = participantAssignments()
  return attendance.map(row => ({ id: row.id, assignmentId: row.assignmentId, date: work.find(item => item.id === row.assignmentId)!.startAt.slice(0, 10), attendance: 'PRESENT', verification: row.state === 'APPROVED' ? 'VERIFIED' : 'PENDING', evidence: true }))
}
// Fictional finance records, not organizational fee/budget policy. Minor units are ETB cents.
export const allowanceRecords: AllowanceSummary[] = (['SUBMITTED', 'VERIFIED', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED', 'RETURNED', 'CANCELLED'] as const).map((state, index) => ({ ...placement, id: `synthetic-allowance-${index}`, title: `Community outreach allowance ${index + 1}`, volunteerId: 'fictional-person-7', supervisorId: 'fictional-person-5', createdBy: 'fictional-person-8', approvedBy: ['APPROVED', 'PROCESSING', 'PAID', 'FAILED'].includes(state) ? 'fictional-finance-reviewer' : null, amountMinor: (index + 1) * 10000, state, updatedAt: `2026-11-${String(10 + index).padStart(2, '0')}T08:00:00Z` }))
allowanceRecords.push({ ...allowanceRecords[1]!, id: 'synthetic-allowance-own-request', createdBy: 'fictional-person-6' }, { ...allowanceRecords[2]!, id: 'synthetic-allowance-own-approval', approvedBy: 'fictional-person-6' }, { ...allowanceRecords[1]!, id: 'synthetic-allowance-outside', branchId: 'fictional-branch-b', areaId: 'fictional-area-b', projectId: 'fictional-project-b', volunteerId: 'fictional-outside-volunteer', supervisorId: 'fictional-outside-supervisor', title: 'Outside branch allowance' })
export const paymentRecords: PaymentSummary[] = (['PENDING', 'SUCCESSFUL', 'FAILED', 'CANCELLED'] as const).map((state, index) => ({ ...placement, id: `synthetic-collection-${index}`, title: `Demo collection ${index + 1}`, payerId: 'fictional-person-7', amountMinor: 15000, state, updatedAt: '2026-11-17T08:00:00Z' }))
export const budgetRecords: BudgetSummary[] = [{ ...placement, id: 'synthetic-budget-a', title: 'Demo outreach allocation', availableMinor: 250000 }]
