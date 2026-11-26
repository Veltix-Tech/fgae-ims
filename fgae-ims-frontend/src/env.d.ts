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

declare module '@application-adapter' {
  export const applicationService: import('./services/contracts/application').ApplicationService
}

declare module '@correction-adapter' {
  export const correctionService: import('./services/contracts/corrections').CorrectionService
}

declare module '@account-adapter' {
  export const accountService: import('./services/contracts/account').AccountService
}

declare module '@overview-adapter' {
  export const overviewService: import('./services/contracts/overview').OverviewService
}

declare module '@hr-overview-adapter' {
  export const hrOverviewService: import('./services/contracts/hr-overview').HrOverviewService
}

declare module '@manager-overview-adapter' {
  export const managerOverviewService: import('./services/contracts/manager-overview').ManagerOverviewService
}

declare module '@participant-overview-adapter' {
  export const participantOverviewService: import('./services/contracts/participant-overview').ParticipantOverviewService
}

declare module '@portfolio-adapter' {
  export const portfolioService: import('./services/contracts/portfolio').PortfolioService
}

declare module '@user-access-adapter' { export const accessService: import('./services/contracts/user-access').AccessService }

declare module '@areas-adapter' { export const areaService: import('./services/contracts/areas').AreaService }

declare module '@branches-adapter' { export const branchService: import('./services/contracts/branches').BranchService }

declare module '@facilities-adapter' { export const facilityService: import('./services/contracts/facilities').FacilityService }
