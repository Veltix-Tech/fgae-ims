import { authService } from './auth'
import { readWorkLocations, readWorkRows, readVolunteerSummaries, readApplicationSummaries } from './operations'
import { canReadManager, canReadLocation, ManagerError, mapManagerOverview, type ManagerOverviewService } from '../services/contracts/manager-overview'
export const managerOverviewService: ManagerOverviewService = {
  async load(kind, signal) {
    const identity = await authService.restore(signal)
    if (!identity) throw new ManagerError('SESSION_EXPIRED')
    if (!canReadManager(identity, kind)) throw new ManagerError('FORBIDDEN')
    const locations = readWorkLocations().filter(location => canReadLocation(identity, kind, location))
    const scoped = (locationId: string) => locations.some(location => location.id === locationId)
    const work = readWorkRows(kind === 'area-manager' ? 'area' : 'branch').filter(row => scoped(row.locationId))
    const volunteers = readVolunteerSummaries().filter(row => scoped(row.locationId))
    const applications = kind === 'volunteer-manager' ? readApplicationSummaries().filter(row => scoped(row.locationId)).map(({ id, name, locationId, state, updatedAt }) => ({ id, name, locationId, state, updatedAt })) : []
    const current = work.filter(row => !['COMPLETED', 'CANCELLED'].includes(row.state))
    const counts = { applications: applications.length, work: work.length, active: work.filter(row => row.state === 'ACTIVE').length, allocation: current.filter(row => row.needsAllocation).length,
      unfilled: current.reduce((sum, row) => sum + row.target - row.assigned, 0), supervision: current.filter(row => row.needsSupervisor).length, attendance: work.reduce((sum, row) => sum + row.attendancePending, 0),
      volunteers: volunteers.filter(row => row.state === 'ACTIVE').length, inactiveVolunteers: volunteers.filter(row => row.state === 'INACTIVE').length,
      pending: applications.filter(row => row.state === 'PENDING').length, returned: applications.filter(row => row.state === 'RETURNED').length }
    signal?.throwIfAborted()
    return { identity, overview: mapManagerOverview({ ownerId: identity.id, kind, generatedAt: new Date().toISOString(), locations, counts,
      work: work.sort((a, b) => Number(['COMPLETED', 'CANCELLED'].includes(a.state)) - Number(['COMPLETED', 'CANCELLED'].includes(b.state)) || Date.parse(a.dueAt) - Date.parse(b.dueAt)).slice(0, 6),
      volunteers: volunteers.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 6), applications: applications.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 6),
    }, identity, kind) }
  },
}
