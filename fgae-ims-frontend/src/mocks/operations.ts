import { baseLocations } from './organization-store'
import type { WorkLocation, WorkRow, VolunteerRow } from '../services/contracts/manager-overview'
import { accounts } from './identities'
import { readRegisteredIdentities } from './credentials'
import { readApplication } from './application'
// Related fictional activity, allocation, assignment and attendance records, not UI counters.
export { readWorkLocations } from './organization-store'
export const workLocations: WorkLocation[] = baseLocations
export const allocations = [
  { id: 'synthetic-work-outreach', title: 'Community outreach', areaId: 'fictional-area-a', branchId: 'fictional-branch-a', state: 'ACTIVE' as const, dueAt: '2026-11-25T14:00:00Z', target: 3 },
  { id: 'synthetic-work-education', title: 'Youth education session', areaId: 'fictional-area-a', branchId: 'fictional-branch-a', state: 'PLANNED' as const, dueAt: '2026-11-28T14:00:00Z', target: 2 },
  { id: 'synthetic-work-incoming', title: 'Community information session', areaId: 'fictional-area-a', branchId: null, state: 'PLANNED' as const, dueAt: '2026-12-02T14:00:00Z', target: 2 },
  { id: 'synthetic-work-completed', title: 'Volunteer orientation', areaId: 'fictional-area-a', branchId: 'fictional-branch-a', state: 'COMPLETED' as const, dueAt: '2026-11-12T14:00:00Z', target: 1 },
  { id: 'synthetic-work-outside', title: 'Branch B outreach', areaId: 'fictional-area-b', branchId: 'fictional-branch-b', state: 'ACTIVE' as const, dueAt: '2026-11-26T14:00:00Z', target: 1 },
]
export const assignments = [
  { id: 'assignment-1', workId: 'synthetic-work-outreach', volunteerId: 'fictional-person-7', supervisorId: null },
  { id: 'assignment-2', workId: 'synthetic-work-completed', volunteerId: 'fictional-person-7', supervisorId: 'fictional-person-5' },
]
export const attendance = [{ id: 'attendance-1', assignmentId: 'assignment-1', state: 'PENDING' }, { id: 'attendance-2', assignmentId: 'assignment-2', state: 'APPROVED' }]
export function readWorkRows(level: 'area' | 'branch'): WorkRow[] {
  return allocations.filter(row => level === 'area' || row.branchId).map(row => {
    const assigned = assignments.filter(item => item.workId === row.id)
    return { id: row.id, title: row.title, locationId: level === 'area' ? row.areaId : row.branchId!, state: row.state, dueAt: row.dueAt, target: row.target, assigned: assigned.length,
      attendancePending: attendance.filter(item => item.state === 'PENDING' && assigned.some(assignment => assignment.id === item.assignmentId)).length,
      needsAllocation: !row.branchId && !['COMPLETED', 'CANCELLED'].includes(row.state), needsSupervisor: !['COMPLETED', 'CANCELLED'].includes(row.state) && assigned.some(item => !item.supervisorId),
    }
  })
}
export function readApplicationSummaries() {
  const identities = new Map([...accounts, ...readRegisteredIdentities()].map(identity => [identity.id, identity]))
  return [...identities.values()].flatMap(identity => { const row = readApplication(identity); return row ? [{ id: row.id, ownerId: row.ownerId, name: row.fields.fullName, locationId: row.fields.branchId, state: row.status, updatedAt: row.updatedAt }] : [] })
}
export function readVolunteerSummaries(): VolunteerRow[] {
  // Approved applications provide the existing active profile projection, never pending signups.
  return readApplicationSummaries().filter(row => row.state === 'APPROVED').map(row => ({ id: row.ownerId, name: row.name, locationId: row.locationId, state: 'ACTIVE', updatedAt: row.updatedAt }))
}
