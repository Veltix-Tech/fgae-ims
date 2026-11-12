import { client } from './live-auth'
import { type FirstLoginService } from '../contracts/first-login'

// C-AUTH-08 is proposed; the backend must enforce the restricted session and revoke old sessions.
export const firstLoginService: FirstLoginService = { complete: (input, signal) => client.replaceTemporaryPassword(input, signal) }
