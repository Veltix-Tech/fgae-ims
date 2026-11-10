/// <reference types="vite/client" />
declare module '@auth-adapter' {
  export const authService: import('./services/contracts/auth').AuthService
}
declare module '@recovery-adapter' {
  export const recoveryService: import('./services/contracts/recovery').RecoveryService
}
