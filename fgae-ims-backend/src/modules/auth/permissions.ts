
export const PERMISSIONS = {
  // User and account management
  USER_READ: "user:read",
  USER_CREATE: "user:create",
  USER_UPDATE: "user:update",

  // Volunteer management
  VOLUNTEER_READ: "volunteer:read",
  VOLUNTEER_CREATE: "volunteer:create",
  VOLUNTEER_UPDATE: "volunteer:update",
  VOLUNTEER_APPROVE: "volunteer:approve",

  // Project management
  PROJECT_READ: "project:read",
  PROJECT_CREATE: "project:create",
  PROJECT_UPDATE: "project:update",
  PROJECT_APPROVE: "project:approve",

  // Finance management
  FINANCE_READ: "finance:read",
  FINANCE_BUDGET_MANAGE: "finance:budget:manage",
  FINANCE_PAYMENT_PROCESS: "finance:payment:process",

  // Allowance management
  // Volunteer allowance management
VOLUNTEER_ALLOWANCE_REQUEST: "volunteer_allowance:request",
VOLUNTEER_ALLOWANCE_APPROVE: "volunteer_allowance:approve",

// Project Manager allowance management
PROJECT_ALLOWANCE_REQUEST: "project_allowance:request",
PROJECT_ALLOWANCE_APPROVE: "project_allowance:approve",

  // HR management
  HR_READ: "hr:read",
  HR_CREATE: "hr:create",
  HR_UPDATE: "hr:update",
} as const;

export type Permission =
  (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
