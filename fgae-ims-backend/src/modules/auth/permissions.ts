
export const PERMISSIONS = {
  // User management
  USER_READ: "user:read",
  USER_CREATE: "user:create",
  USER_UPDATE: "user:update",
  USER_DEACTIVATE: "user:deactivate",

  // Volunteer management
  VOLUNTEER_READ: "volunteer:read",
  VOLUNTEER_CREATE: "volunteer:create",
  VOLUNTEER_UPDATE: "volunteer:update",
  VOLUNTEER_DEACTIVATE: "volunteer:deactivate",

  // Project management
  PROJECT_READ: "project:read",
  PROJECT_CREATE: "project:create",
  PROJECT_UPDATE: "project:update",
  PROJECT_SUBMIT: "project:submit",
  PROJECT_APPROVE: "project:approve",
  PROJECT_REJECT: "project:reject",
  PROJECT_ARCHIVE: "project:archive",

  // Task management
  TASK_READ: "task:read",
  TASK_CREATE: "task:create",
  TASK_ASSIGN: "task:assign",
  TASK_UPDATE: "task:update",
  TASK_STATUS_UPDATE: "task:status_update",

  // Finance and budgets
  FINANCE_READ: "finance:read",
  FINANCE_BUDGET_VIEW: "finance:budget_view",
  FINANCE_BUDGET_MANAGE: "finance:budget_manage",
  FINANCE_PAYMENT_PROCESS: "finance:payment_process",
  FINANCE_TRANSACTION_VIEW: "finance:transaction_view",
  FINANCE_REPORT_VIEW: "finance:report_view",

  // Volunteer allowances
  VOLUNTEER_ALLOWANCE_REQUEST: "volunteer_allowance:request",
  VOLUNTEER_ALLOWANCE_APPROVE: "volunteer_allowance:approve",
  VOLUNTEER_ALLOWANCE_REJECT: "volunteer_allowance:reject",

  // Human resources (read-only)
  HR_READ: "hr:read",

  // Organizational structure
  AREA_READ: "area:read",
  AREA_MANAGE: "area:manage",
  BRANCH_READ: "branch:read",
  BRANCH_MANAGE: "branch:manage",

  // Role administration
  ROLE_READ: "role:read",
  ROLE_ASSIGN: "role:assign",

  // Reports and audit
  REPORT_READ: "report:read",
  REPORT_EXPORT: "report:export",
  AUDIT_LOG_READ: "audit_log:read",
} as const;

export type Permission =
  (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export interface PermissionDefinition {
  key: Permission;
  module: string;
  label: string;
  description: string;
}

export const PERMISSION_CATALOG: readonly PermissionDefinition[] = [
  // Users
  { key: PERMISSIONS.USER_READ, module: "Users", label: "View users", description: "View user accounts." },
  { key: PERMISSIONS.USER_CREATE, module: "Users", label: "Create users", description: "Create user accounts." },
  { key: PERMISSIONS.USER_UPDATE, module: "Users", label: "Update users", description: "Edit user information." },
  { key: PERMISSIONS.USER_DEACTIVATE, module: "Users", label: "Deactivate users", description: "Deactivate user accounts." },

  // Volunteers
  { key: PERMISSIONS.VOLUNTEER_READ, module: "Volunteers", label: "View volunteers", description: "View volunteer records within assigned scope." },
  { key: PERMISSIONS.VOLUNTEER_CREATE, module: "Volunteers", label: "Register volunteers", description: "Enter new volunteer information." },
  { key: PERMISSIONS.VOLUNTEER_UPDATE, module: "Volunteers", label: "Update volunteers", description: "Edit volunteer information." },
  { key: PERMISSIONS.VOLUNTEER_DEACTIVATE, module: "Volunteers", label: "Deactivate volunteers", description: "Deactivate volunteer records." },

  // Projects
  { key: PERMISSIONS.PROJECT_READ, module: "Projects", label: "View projects", description: "View project information." },
  { key: PERMISSIONS.PROJECT_CREATE, module: "Projects", label: "Create projects", description: "Create new projects." },
  { key: PERMISSIONS.PROJECT_UPDATE, module: "Projects", label: "Update projects", description: "Edit project information." },
  { key: PERMISSIONS.PROJECT_SUBMIT, module: "Projects", label: "Submit projects", description: "Submit project proposals." },
  { key: PERMISSIONS.PROJECT_APPROVE, module: "Projects", label: "Approve projects", description: "Approve project proposals." },
  { key: PERMISSIONS.PROJECT_REJECT, module: "Projects", label: "Reject projects", description: "Reject project proposals." },
  { key: PERMISSIONS.PROJECT_ARCHIVE, module: "Projects", label: "Archive projects", description: "Archive completed or cancelled projects." },

  // Tasks
  { key: PERMISSIONS.TASK_READ, module: "Tasks", label: "View tasks", description: "View tasks within assigned scope." },
  { key: PERMISSIONS.TASK_CREATE, module: "Tasks", label: "Create tasks", description: "Create tasks for volunteers." },
  { key: PERMISSIONS.TASK_ASSIGN, module: "Tasks", label: "Assign tasks", description: "Assign tasks to volunteers." },
  { key: PERMISSIONS.TASK_UPDATE, module: "Tasks", label: "Update tasks", description: "Edit tasks within assigned scope." },
  { key: PERMISSIONS.TASK_STATUS_UPDATE, module: "Tasks", label: "Update task status", description: "Update task progress." },

  // Finance
  { key: PERMISSIONS.FINANCE_READ, module: "Finance", label: "View finance", description: "View financial information." },
  { key: PERMISSIONS.FINANCE_BUDGET_VIEW, module: "Finance", label: "View budgets", description: "View budgets and balances." },
  { key: PERMISSIONS.FINANCE_BUDGET_MANAGE, module: "Finance", label: "Manage budgets", description: "Manage financial budgets and allocations." },
  { key: PERMISSIONS.FINANCE_PAYMENT_PROCESS, module: "Finance", label: "Process payments", description: "Process approved payments." },
  { key: PERMISSIONS.FINANCE_TRANSACTION_VIEW, module: "Finance", label: "View transactions", description: "View financial transactions." },
  { key: PERMISSIONS.FINANCE_REPORT_VIEW, module: "Finance", label: "View finance reports", description: "View financial reports." },

  // Volunteer allowances
  { key: PERMISSIONS.VOLUNTEER_ALLOWANCE_REQUEST, module: "Volunteer Allowances", label: "Request allowance", description: "Submit personal volunteer allowance requests." },
  { key: PERMISSIONS.VOLUNTEER_ALLOWANCE_APPROVE, module: "Volunteer Allowances", label: "Approve allowance", description: "Approve volunteer allowance requests." },
  { key: PERMISSIONS.VOLUNTEER_ALLOWANCE_REJECT, module: "Volunteer Allowances", label: "Reject allowance", description: "Reject volunteer allowance requests." },

  // HR
  { key: PERMISSIONS.HR_READ, module: "HR", label: "View HR records", description: "Read employee and HR records without editing them." },

  // Organization
  { key: PERMISSIONS.AREA_READ, module: "Organization", label: "View areas", description: "View area information." },
  { key: PERMISSIONS.AREA_MANAGE, module: "Organization", label: "Manage areas", description: "Manage area information." },
  { key: PERMISSIONS.BRANCH_READ, module: "Organization", label: "View branches", description: "View branch information." },
  { key: PERMISSIONS.BRANCH_MANAGE, module: "Organization", label: "Manage branches", description: "Manage branch information." },

  // Access management
  { key: PERMISSIONS.ROLE_READ, module: "Access Management", label: "View roles", description: "View predefined system roles." },
  { key: PERMISSIONS.ROLE_ASSIGN, module: "Access Management", label: "Assign roles", description: "Assign predefined roles to users." },

  // Reports and audit
  { key: PERMISSIONS.REPORT_READ, module: "Reports", label: "View reports", description: "View authorized reports." },
  { key: PERMISSIONS.REPORT_EXPORT, module: "Reports", label: "Export reports", description: "Export authorized reports." },
  { key: PERMISSIONS.AUDIT_LOG_READ, module: "Audit", label: "View audit logs", description: "View important system activity." },
];
