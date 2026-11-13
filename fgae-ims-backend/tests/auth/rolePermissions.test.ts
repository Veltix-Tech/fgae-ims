
import { describe, it, expect } from "vitest";

import {
  ROLES,
  roleHasPermission,
} from "../../src/modules/auth/rolePermissions.js";

import { PERMISSIONS } from "../../src/modules/auth/permissions.js";

describe("Role permissions", () => {
  it("should allow a Volunteer Manager to approve volunteers", () => {
    expect(
      roleHasPermission(
        ROLES.VOLUNTEER_MANAGER,
        PERMISSIONS.VOLUNTEER_APPROVE
      )
    ).toBe(true);
  });

  it("should prevent a Field Supervisor from processing payments", () => {
    expect(
      roleHasPermission(
        ROLES.FIELD_SUPERVISOR,
        PERMISSIONS.FINANCE_PAYMENT_PROCESS
      )
    ).toBe(false);
  });

  it("should allow Finance Officer to process payments", () => {
    expect(
      roleHasPermission(
        ROLES.FINANCE_OFFICER,
        PERMISSIONS.FINANCE_PAYMENT_PROCESS
      )
    ).toBe(true);
  });

  it("should give HR Officer read-only HR access", () => {
    expect(
      roleHasPermission(
        ROLES.HR_OFFICER,
        PERMISSIONS.HR_READ
      )
    ).toBe(true);

    expect(
      roleHasPermission(
        ROLES.HR_OFFICER,
        PERMISSIONS.HR_CREATE
      )
    ).toBe(false);
  });

  it("should not give Branch Manager unconfirmed permissions", () => {
    expect(
      roleHasPermission(
        ROLES.BRANCH_MANAGER,
        PERMISSIONS.VOLUNTEER_APPROVE
      )
    ).toBe(false);
  });

  it("should prevent a Field Supervisor from approving project allowances", () => {
  expect(
    roleHasPermission(
      ROLES.FIELD_SUPERVISOR,
      PERMISSIONS.PROJECT_ALLOWANCE_APPROVE
    )
  ).toBe(false);
});

it("should prevent an Area Manager from approving volunteer allowances", () => {
  expect(
    roleHasPermission(
      ROLES.AREA_MANAGER,
      PERMISSIONS.VOLUNTEER_ALLOWANCE_APPROVE
    )
  ).toBe(false);
});
});
