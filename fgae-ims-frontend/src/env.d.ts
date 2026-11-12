/// <reference types="vite/client" />
declare module '@registration-adapter' {
  export const registrationService: import('./services/contracts/registration').RegistrationService
}
declare module '@first-login-adapter' {
  export const firstLoginService: import('./services/contracts/first-login').FirstLoginService
}
declare module '@auth-adapter' {
  export const authService: import('./services/contracts/auth').AuthService
}
declare module '@recovery-adapter' {
  export const recoveryService: import('./services/contracts/recovery').RecoveryService
}
declare module '@reset-adapter' {
  export const resetPasswordService: import('./services/contracts/reset-password').ResetPasswordService
}
