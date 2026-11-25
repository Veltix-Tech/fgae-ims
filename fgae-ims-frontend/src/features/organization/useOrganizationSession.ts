import {useCallback,useEffect,useRef,useState} from 'react'
import {authService} from '@auth-adapter'
import {canReadAreas} from '../../services/contracts/areas'
import type {Identity} from '../../services/contracts/auth'
import type {TranslationKey} from '../../i18n/locales/en/auth'
export const organizationError = (failure:unknown):TranslationKey => {
 const code=failure instanceof Error&&'code' in failure?String(failure.code):''
 const errors:Record<string,TranslationKey>={FORBIDDEN:'mgrDeniedNote',SESSION_EXPIRED:'homeSignInNote',NETWORK:'NETWORK',RATE_LIMITED:'RATE_LIMITED',STORAGE_UNAVAILABLE:'STORAGE_UNAVAILABLE',VALIDATION:'orgValidation',DUPLICATE:'orgDuplicate',CONFLICT:'orgStale',NOT_FOUND:'orgNotFound',IMPACT_BLOCKED:'orgImpactBlocked'}
 return errors[code]??'mgrUnavailable'
}
const signature=(i:Identity)=>JSON.stringify([i.id,i.accountState,i.mustChangePassword,i.grants])
export function useOrganizationSession<T extends {identity:Identity}>(loader:(signal:AbortSignal)=>Promise<T>){
 const [data,setData]=useState<T|null>(null);const [busy,setBusy]=useState(true);const [error,setError]=useState<TranslationKey|null>(null);const request=useRef<AbortController|null>(null)
 const load=useCallback(async()=>{request.current?.abort();const controller=new AbortController();request.current=controller;setBusy(true);setError(null);setData(null);try{const loaded=await loader(controller.signal);if(!controller.signal.aborted)setData(loaded)}catch(failure){if(!controller.signal.aborted)setError(organizationError(failure))}finally{if(!controller.signal.aborted)setBusy(false)}},[loader])
 useEffect(()=>{let active=true;void Promise.resolve().then(()=>{if(active)void load()});return()=>{active=false;request.current?.abort()}},[load])
 useEffect(()=>{const controller=new AbortController();const clear=()=>{request.current?.abort();setData(null);setBusy(false);setError('homeSignInNote')};const verify=async()=>{if(!data||document.hidden)return;try{const identity=await authService.restore(controller.signal);if(!controller.signal.aborted&&(!identity||!canReadAreas(identity)||signature(identity)!==signature(data.identity)))clear()}catch{if(!controller.signal.aborted)clear()}};const bus=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('fgae.auth'):null;if(bus)bus.onmessage=clear;const timer=setInterval(()=>void verify(),60000);window.addEventListener('focus',verify);return()=>{controller.abort();bus?.close();clearInterval(timer);window.removeEventListener('focus',verify)}},[data])
 return {data,busy,error,load}
}
