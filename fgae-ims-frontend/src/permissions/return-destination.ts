import type {Identity} from '../services/contracts/auth'
// Only implemented protected routes can be return destinations. Never follow an arbitrary URL.
const route = /^(?:\/(?:areas|branches|facilities|users)(?:\/[^/]+(?:\/edit)?)?|\/account|\/my-application(?:\/edit)?|\/workspaces\/(?:super-admin|hr|area-manager|branch-manager|volunteer-manager|field-supervisor|finance-officer|volunteer|project-manager|member))$/
export function safeReturnDestination(value: string | null): string | null {
  if (!value || value.length > 4096 || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || [...value].some(char => char.charCodeAt(0) <= 32)) return null
  try {
    const url = new URL(value, 'https://fgae.invalid')
    if (url.origin !== 'https://fgae.invalid' || !route.test(url.pathname)) return null
    return url.pathname + url.search + url.hash
  } catch { return null }
}
export function readReturnDestination(search = location.search): string | null {
  const values = new URLSearchParams(search).getAll('returnTo')
  return values.length === 1 ? safeReturnDestination(values[0]!) : null
}
export function signInReturnHref(destination = location.pathname + location.search + location.hash): string {
  const safe = safeReturnDestination(destination)
  return safe ? `/sign-in?${new URLSearchParams({returnTo:safe})}` : '/sign-in'
}
export function afterSignInDestination(identity: Identity, destination: string | null): string | null {
  const safe = safeReturnDestination(destination)
  if (!safe) return null
  // Mandatory password replacement must finish before protected content is available.
  return identity.mustChangePassword ? `/first-login?${new URLSearchParams({returnTo:safe})}` : safe
}
