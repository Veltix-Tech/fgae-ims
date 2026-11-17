import { authService } from './auth'
import { personnelBranches, readPersonnelSummaries } from './personnel'
import { canReadHr, canReadHrBranch, HrError, mapHrOverview, type HrOverviewService } from '../services/contracts/hr-overview'
export const hrOverviewService: HrOverviewService = {
  async load(signal) {
    const identity = await authService.restore(signal)
    if (!identity) throw new HrError('SESSION_EXPIRED')
    if (!canReadHr(identity)) throw new HrError('FORBIDDEN')
    const branches = personnelBranches.filter(branch => canReadHrBranch(identity, branch))
    const records = readPersonnelSummaries().filter(record => branches.some(branch => branch.id === record.branchId))
    const counts = { total: records.length, active: records.filter(item => item.employment === 'ACTIVE').length, onLeave: records.filter(item => item.employment === 'ON_LEAVE').length, ended: records.filter(item => item.employment === 'ENDED').length, needsContact: records.filter(item => item.needsContact).length, needsJob: records.filter(item => item.needsJob).length }
    signal?.throwIfAborted()
    return { identity, overview: mapHrOverview({ ownerId: identity.id, generatedAt: new Date().toISOString(), branches, counts, recent: records.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 6) }, identity) }
  },
}
