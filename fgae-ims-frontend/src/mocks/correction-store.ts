import { CorrectionError, type CorrectionContext, type CorrectionReceipt } from '../services/contracts/corrections'
import { registrationConfig } from './registration'
const key = 'fgae.synthetic.corrections.v1'
export interface Workflow extends CorrectionContext { receipts: { key: string; payload: string; receipt: CorrectionReceipt }[]; versions?: { revision: number; fields: CorrectionContext['application']['fields']; documents: CorrectionContext['application']['documents'] }[] }
export function readWorkflow(ownerId: string): Workflow | null {
  try {
    const stored = JSON.parse(localStorage.getItem(key) || '{}') as Record<string, Workflow>
    if (stored[ownerId]) return structuredClone(stored[ownerId])
  } catch { throw new CorrectionError('STORAGE_UNAVAILABLE') }
  if (ownerId !== 'fictional-returned-applicant') return null
  const submittedAt = '2026-11-10T08:00:00.000Z'; const returnedAt = '2026-11-12T08:00:00.000Z'
  return { revision: 2, draftVersion: 0, draft: null, editableFields: ['phone', 'branchId'], documentTypes: ['identity'], config: structuredClone(registrationConfig), receipts: [],
    application: { id: 'synthetic-returned-application', ownerId, status: 'RETURNED', submittedAt, updatedAt: returnedAt,
      fields: { fullName: 'Demo Returned Applicant', email: 'returned@example.test', phone: '+251911111111', birthDate: '2000-02-29', gender: 'UNDISCLOSED', branchId: 'fictional-branch-a' }, branchName: 'Demo branch A', documents: [],
      history: [{ id: 'submitted', status: 'PENDING', at: submittedAt, note: '' }, { id: 'returned', status: 'RETURNED', at: returnedAt, note: 'Please confirm your phone number and preferred branch, and add a clear identity document.' }],
    },
  }
}
let queue = Promise.resolve()
export async function changeWorkflow<T>(ownerId: string, guard: () => Promise<void>, change: (workflow: Workflow) => T, signal?: AbortSignal): Promise<T> {
  const operation = async () => {
    await guard(); signal?.throwIfAborted()
    const workflow = readWorkflow(ownerId)
    if (!workflow) throw new CorrectionError('NOT_RETURNED')
    const result = change(workflow)
    signal?.throwIfAborted()
    // Synchronous read/modify/write under the shared lock: draft, status, history and receipt commit together.
    try { const state = JSON.parse(localStorage.getItem(key) || '{}') as Record<string, Workflow>; state[ownerId] = workflow; localStorage.setItem(key, JSON.stringify(state)) }
    catch { throw new CorrectionError('STORAGE_UNAVAILABLE') }
    return result
  }
  if (navigator.locks) return navigator.locks.request(key, operation)
  const result = queue.then(operation, operation); queue = result.then(() => undefined, () => undefined); return result
}
