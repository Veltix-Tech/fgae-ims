import { authService } from './auth'
import { accounts } from './identities'
import { readRegisteredIdentities } from './credentials'
import { readApplication } from './application'
import { canReadOverview, mapOverview, OverviewError, type OverviewService } from '../services/contracts/overview'
export const overviewService: OverviewService = {
  async load(signal) {
    const identity = await authService.restore(signal)
    if (!identity) throw new OverviewError('SESSION_EXPIRED')
    if (!canReadOverview(identity)) throw new OverviewError('FORBIDDEN')
    const people = new Map([...accounts, ...readRegisteredIdentities()].map(person => [person.id, person]))
    const records = [...people.values()].flatMap(person => { const record = readApplication(person); return record ? [record] : [] })
    const counts = { PENDING: 0, RETURNED: 0, APPROVED: 0, REJECTED: 0 }
    for (const record of records) counts[record.status]++
    signal?.throwIfAborted()
    return { identity, overview: mapOverview({ ownerId: identity.id, scope: 'global', generatedAt: new Date().toISOString(), counts,
      recent: records.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 6).map(record => ({ id: record.id, name: record.fields.fullName, branch: record.branchName, status: record.status, updatedAt: record.updatedAt })),
    }, identity.id) }
  },
}
