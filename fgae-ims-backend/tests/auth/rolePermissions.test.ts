
import { describe, it, expect } from "vitest";

import {
  ROLES,
  DEFAULT_ROLE_PERMISSIONS,
  roleHasPermission,
} from "../../src/modules/auth/rolePermissions.js";

import { PERMISSIONS } from "../../src/modules/auth/permissions.js";

describe("Role permissions", () => {
  it("should define all nine built-in roles", () => {
    expect(Object.keys(ROLES)).toHaveLength(9);
  });

  it("should give Super Admin all supported permissions", () => {
    expect(DEFAULT_ROLE_PERMISSIONS.SUPER_ADMIN).toEqual(
      Object.values(PERMISSIONS)
    );
  });

  it("should give Project Manager project and task permissions", () => {
    expect(roleHasPermission("PROJECT_MANAGER", PERMISSIONS.PROJECT_CREATE)).toBe(true);
    expect(roleHasPermission("PROJECT_MANAGER", PERMISSIONS.PROJECT_UPDATE)).toBe(true);
    expect(roleHasPermission("PROJECT_MANAGER", PERMISSIONS.PROJECT_SUBMIT)).toBe(true);
    expect(roleHasPermission("PROJECT_MANAGER", PERMISSIONS.TASK_CREATE)).toBe(true);
  });

  it("should not allow Project Manager to request volunteer allowances", () => {
    expect(
      roleHasPermission("PROJECT_MANAGER", PERMISSIONS.VOLUNTEER_ALLOWANCE_REQUEST)
    ).toBe(false);
  });

  it("should not allow Project Manager to process payments", () => {
    expect(
      roleHasPermission("PROJECT_MANAGER", PERMISSIONS.FINANCE_PAYMENT_PROCESS)
    ).toBe(false);
  });

  it("should give Area Manager project approval permissions", () => {
    expect(roleHasPermission("AREA_MANAGER", PERMISSIONS.PROJECT_APPROVE)).toBe(true);
    expect(roleHasPermission("AREA_MANAGER", PERMISSIONS.PROJECT_REJECT)).toBe(true);
  });

  it("should give Area Manager budget management permissions", () => {
    expect(
      roleHasPermission("AREA_MANAGER", PERMISSIONS.FINANCE_BUDGET_MANAGE)
    ).toBe(true);
  });

  it("should give Volunteer Manager volunteer management permissions", () => {
    expect(roleHasPermission("VOLUNTEER_MANAGER", PERMISSIONS.VOLUNTEER_READ)).toBe(true);
    expect(roleHasPermission("VOLUNTEER_MANAGER", PERMISSIONS.VOLUNTEER_CREATE)).toBe(true);
    expect(roleHasPermission("VOLUNTEER_MANAGER", PERMISSIONS.VOLUNTEER_UPDATE)).toBe(true);
  });

  it("should give Field Supervisor allowance approval permissions", () => {
    expect(
      roleHasPermission("FIELD_SUPERVISOR", PERMISSIONS.VOLUNTEER_ALLOWANCE_APPROVE)
    ).toBe(true);

    expect(
      roleHasPermission("FIELD_SUPERVISOR", PERMISSIONS.VOLUNTEER_ALLOWANCE_REJECT)
    ).toBe(true);
  });

  it("should give Finance Officer payment processing permission", () => {
    expect(
      roleHasPermission("FINANCE_OFFICER", PERMISSIONS.FINANCE_PAYMENT_PROCESS)
    ).toBe(true);
  });

  it("should keep HR Officer read-only", () => {
    expect(roleHasPermission("HR_OFFICER", PERMISSIONS.HR_READ)).toBe(true);
    expect(roleHasPermission("HR_OFFICER", PERMISSIONS.FINANCE_READ)).toBe(true);
    expect(roleHasPermission("HR_OFFICER", PERMISSIONS.FINANCE_PAYMENT_PROCESS)).toBe(false);
    expect(roleHasPermission("HR_OFFICER", PERMISSIONS.USER_UPDATE)).toBe(false);
  });

  it("should allow volunteers to request their own allowances", () => {
    expect(
      roleHasPermission("VOLUNTEER", PERMISSIONS.VOLUNTEER_ALLOWANCE_REQUEST)
    ).toBe(true);
  });

  it("should give Branch Manager branch oversight permissions", () => {
    expect(roleHasPermission("BRANCH_MANAGER", PERMISSIONS.BRANCH_READ)).toBe(true);
    expect(roleHasPermission("BRANCH_MANAGER", PERMISSIONS.VOLUNTEER_READ)).toBe(true);
    expect(roleHasPermission("BRANCH_MANAGER", PERMISSIONS.PROJECT_READ)).toBe(true);
    expect(roleHasPermission("BRANCH_MANAGER", PERMISSIONS.FINANCE_READ)).toBe(true);
    expect(roleHasPermission("BRANCH_MANAGER", PERMISSIONS.FINANCE_BUDGET_VIEW)).toBe(true);
    expect(roleHasPermission("BRANCH_MANAGER", PERMISSIONS.FINANCE_REPORT_VIEW)).toBe(true);
    expect(roleHasPermission("BRANCH_MANAGER", PERMISSIONS.TASK_READ)).toBe(true);
  });

  it("should allow Field Supervisor to manage volunteer tasks", () => {
    expect(roleHasPermission("FIELD_SUPERVISOR", PERMISSIONS.TASK_CREATE)).toBe(true);
    expect(roleHasPermission("FIELD_SUPERVISOR", PERMISSIONS.TASK_ASSIGN)).toBe(true);
    expect(roleHasPermission("FIELD_SUPERVISOR", PERMISSIONS.TASK_UPDATE)).toBe(true);
  });

  it("should allow volunteers to view and update their tasks", () => {
    expect(roleHasPermission("VOLUNTEER", PERMISSIONS.TASK_READ)).toBe(true);
    expect(roleHasPermission("VOLUNTEER", PERMISSIONS.TASK_STATUS_UPDATE)).toBe(true);
  });

  it("should not give volunteers permission to manage other volunteers", () => {
    expect(roleHasPermission("VOLUNTEER", PERMISSIONS.VOLUNTEER_READ)).toBe(false);
    expect(roleHasPermission("VOLUNTEER", PERMISSIONS.VOLUNTEER_UPDATE)).toBe(false);
  });
});
