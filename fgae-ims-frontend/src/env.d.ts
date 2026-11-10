/// <reference types="vite/client" />
declare module '@auth-adapter' {
  export const authService: import('./services/contracts/auth').AuthService
}
