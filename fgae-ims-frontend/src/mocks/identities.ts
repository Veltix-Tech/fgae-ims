import { roles, type Identity, type Role, type Scope } from '../services/contracts/auth'

const scopeFor = (role: Role, id: string): Scope => role === 'SUPER_ADMIN' ? { kind: 'global', id: '*' } :
  role === 'AREA_MANAGER' ? { kind: 'area', id: 'fictional-area-a' } :
  role === 'FIELD_SUPERVISOR' ? { kind: 'supervision', id } :
  role === 'PROJECT_MANAGER' ? { kind: 'project', id: 'fictional-project-a' } :
  role === 'VOLUNTEER' || role === 'MEMBER' ? { kind: 'self', id } : { kind: 'branch', id: 'fictional-branch-a' }
export const accounts: Identity[] = roles.map((role, index) => ({
  id: `fictional-person-${index}`, name: `Demo ${index + 1}`, email: `${role.toLowerCase().replaceAll('_', '.')}@example.test`,
  grants: [{ role, scope: scopeFor(role, `fictional-person-${index}`) }], accountState: 'ACTIVE', mustChangePassword: false,
}))
accounts.push(
  { id: 'fictional-returned-applicant', name: 'Demo Returned Applicant', email: 'returned@example.test', grants: [], accountState: 'PENDING', mustChangePassword: false },
  { id: 'fictional-applicant', name: 'Demo Applicant', email: 'pending@example.test', grants: [], accountState: 'PENDING', mustChangePassword: false },
  { ...accounts[7]!, id: 'fictional-first-login', email: 'first.login@example.test', grants: [{ role: 'VOLUNTEER', scope: scopeFor('VOLUNTEER', 'fictional-first-login') }], mustChangePassword: true },
  { ...accounts[7]!, email: 'multi.role@example.test', grants: [...accounts[7]!.grants, { role: 'MEMBER', scope: scopeFor('MEMBER', accounts[7]!.id) }] },
)
accounts.push(...roles.map((role, index): Identity => ({
  id: `fictional-temporary-${index}`, name: `Demo temporary ${index + 1}`, email: `first.${role.toLowerCase().replaceAll('_', '.')}@example.test`,
  grants: [{ role, scope: scopeFor(role, `fictional-temporary-${index}`) }], accountState: 'ACTIVE', mustChangePassword: true,
})))
