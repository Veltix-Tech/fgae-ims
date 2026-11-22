import { beforeEach, describe, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { authService } from '../mocks/auth'
import { areaService } from '../mocks/areas'
import { accessScopes } from '../mocks/user-access'
import { accounts } from '../mocks/identities'
import { canReadAreas, mapAreas, validateArea, type AreaInput } from '../services/contracts/areas'
const login = (email = 'super.admin@example.test') => authService.signIn({ email, password: 'Demo-only-2026!' })
const input = (overrides: Partial<AreaInput> = {}): AreaInput => ({ code:'NEW-01',name:'New area',description:'Service expansion',reason:'Approved service expansion',idempotencyKey:crypto.randomUUID(),...overrides })
beforeEach(() => vi.stubGlobal('crypto',webcrypto))
describe('area organization service', () => {
  it('denies anonymous, unrelated roles, temporary accounts and manager writes',async () => {
    await expect(areaService.load()).rejects.toMatchObject({code:'SESSION_EXPIRED'}); await login('hr@example.test'); await expect(areaService.load()).rejects.toMatchObject({code:'FORBIDDEN'}); await login('area.manager@example.test'); await expect(areaService.create(input())).rejects.toMatchObject({code:'FORBIDDEN'}); expect(canReadAreas({...accounts[0]!,mustChangePassword:true})).toBe(false)
  })
  it('limits area and branch managers to permitted records and keeps role scopes paired',async () => {
    await login('area.manager@example.test'); const area = await areaService.load(); expect(area.snapshot.areas.map(a => a.id)).toEqual(['fictional-area-a']); expect(area.snapshot.branches.map(b => b.id)).toEqual(['fictional-branch-a'])
    await login('branch.manager@example.test'); const branch = await areaService.load(); expect(branch.snapshot.areas).toHaveLength(1); expect(branch.snapshot.branches).toHaveLength(1)
    const all = {...accounts[0]!,grants:[{role:'AREA_MANAGER' as const,scope:{kind:'area' as const,id:'fictional-area-a'}},{role:'MEMBER' as const,scope:{kind:'area' as const,id:'fictional-area-b'}}]}; expect(() => mapAreas({...area.snapshot,ownerId:all.id,areas:[...area.snapshot.areas,{...area.snapshot.areas[0]!,id:'fictional-area-b',code:'OTHER'}]},all)).toThrow()
  })
  it('creates durable active areas with audit and exposes the new scope without granting access',async () => {
    const actor = await login(); const created = await areaService.create(input({code:' new-01 ',name:' New area '})); const area = created.snapshot.areas.find(a => a.id === created.id)!; expect(area.code).toBe('NEW-01'); expect(area.state).toBe('ACTIVE'); expect(area.history[0]).toMatchObject({actorId:actor.id,reason:'Approved service expansion'}); expect((await areaService.load()).snapshot.areas).toContainEqual(area); expect(accessScopes().find(s => s.id === area.id)?.kind).toBe('area'); expect((await authService.restore())?.grants).toEqual(actor.grants)
  })
  it('deduplicates concurrent retries and rejects reused keys or duplicate names/codes',async () => {
    await login(); const request = input(); const [first,second] = await Promise.all([areaService.create(request),areaService.create(request)]); expect(first.id).toBe(second.id); expect((await areaService.load()).snapshot.areas).toHaveLength(3); await expect(areaService.create({...request,name:'Other name'})).rejects.toMatchObject({code:'CONFLICT'}); await expect(areaService.create(input({code:'OTHER'}))).rejects.toMatchObject({code:'DUPLICATE'}); await expect(areaService.create(input({name:'Other'}))).rejects.toMatchObject({code:'DUPLICATE'})
  })
  it('validates fields and fails closed on malformed, foreign-owned and cross-scope snapshots',async () => {
    expect(() => validateArea(input({code:'!'}))).toThrow(); expect(() => validateArea(input({reason:'  '}))).toThrow(); expect(() => validateArea(input({description:'x'.repeat(1001)}))).toThrow(); const identity = await login(); const {snapshot} = await areaService.load(); expect(() => mapAreas({...snapshot,areas:[{...snapshot.areas[0]!,code:12}]},identity)).toThrow(); expect(() => mapAreas({...snapshot,ownerId:'other'},identity)).toThrow(); expect(() => mapAreas({...snapshot,branches:[{...snapshot.branches[0]!,areaId:'missing'}]},identity)).toThrow(); expect(() => mapAreas({...snapshot,areas:[...snapshot.areas,snapshot.areas[0]]},identity)).toThrow(); expect(() => mapAreas({...snapshot,areas:[{...snapshot.areas[0]!,history:[{}]}]},identity)).toThrow()
  })
  it('does not write when aborted or storage is unavailable',async () => { await login(); const controller = new AbortController(); controller.abort(); await expect(areaService.create(input(),controller.signal)).rejects.toBeTruthy(); expect((await areaService.load()).snapshot.areas).toHaveLength(2); const set = vi.spyOn(Storage.prototype,'setItem').mockImplementation(() => {throw new Error('quota')}); await expect(areaService.create(input())).rejects.toMatchObject({code:'STORAGE_UNAVAILABLE'}); set.mockRestore(); expect((await areaService.load()).snapshot.areas).toHaveLength(2) })
})
