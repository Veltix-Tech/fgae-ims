import { organizationBranches } from './organization-store'
import type { PersonnelSummary, HrBranch } from '../services/contracts/hr-overview'
import { findAccount, readProfile } from './credentials'
// Fictional personnel records are separate from authentication grants and applications.
// Keep this projection reusable by the later personnel directory service.
export const personnelBranches: HrBranch[] = [
  { id: 'fictional-branch-a', areaId: 'fictional-area-a', name: 'Demo branch A' },
  { id: 'fictional-branch-b', areaId: 'fictional-area-b', name: 'Demo branch B' },
]
const records: (PersonnelSummary & { accountEmail?: string })[] = [
  { id: 'synthetic-staff-1', name: 'Demo 2', accountEmail: 'hr@example.test', branchId: 'fictional-branch-a', jobTitle: 'HR officer', employment: 'ACTIVE', account: 'ACTIVE', needsContact: true, needsJob: false, updatedAt: '2026-11-14T08:00:00Z' },
  { id: 'synthetic-staff-2', name: 'Demo 4', accountEmail: 'branch.manager@example.test', branchId: 'fictional-branch-a', jobTitle: 'Branch coordinator', employment: 'ACTIVE', account: 'ACTIVE', needsContact: false, needsJob: false, updatedAt: '2026-11-13T08:00:00Z' },
  { id: 'synthetic-staff-3', name: 'Demo personnel A', branchId: 'fictional-branch-a', jobTitle: '', employment: 'ON_LEAVE', account: 'NONE', needsContact: false, needsJob: true, updatedAt: '2026-11-12T08:00:00Z' },
  { id: 'synthetic-staff-4', name: 'Demo personnel B', branchId: 'fictional-branch-b', jobTitle: 'Program assistant', employment: 'ACTIVE', account: 'NONE', needsContact: false, needsJob: false, updatedAt: '2026-11-11T08:00:00Z' },
  { id: 'synthetic-staff-5', name: 'Demo former colleague', branchId: 'fictional-branch-b', jobTitle: 'Office assistant', employment: 'ENDED', account: 'SUSPENDED', needsContact: false, needsJob: false, updatedAt: '2026-11-10T08:00:00Z' },
]
export function readPersonnelSummaries(): PersonnelSummary[] {
  return records.map(({ accountEmail, ...record }) => {
    const identity = accountEmail ? findAccount(accountEmail) : undefined
    if (!identity) return { ...record }
    const profile = readProfile(identity)
    // Shared account names/contact may fill gaps; HR-owned job/location fields remain separate.
    return { ...record, name: profile.name, needsContact: record.needsContact && !profile.phone.trim() }
  })
}

export const readPersonnelBranches = (): HrBranch[] => organizationBranches().map(({id,areaId,name}) => ({id,areaId,name}))
