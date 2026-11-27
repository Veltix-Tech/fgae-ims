
import { describe, it, expect } from "vitest";

import { ROLES } from "../../src/modules/auth/rolePermissions.js";
import { PERMISSIONS } from "../../src/modules/auth/permissions.js";

import {
  hasPermission,
  hasScopeAccess,
  type UserAccessContext,
} from "../../src/modules/auth/accessPolicy.js";

const areaManagerContext: UserAccessContext = {
  role: ROLES.AREA_MANAGER,
  rolePermissions: [
    PERMISSIONS.PROJECT_READ,
    PERMISSIONS.VOLUNTEER_READ,
  ],
  areaIds: ["area-A"],
  branchIds: ["branch-B1"],
};

describe("Access policy", () => {
  describe("Permission checks", () => {
    it("should allow permissions assigned to the user's role", () => {
      expect(
        hasPermission(areaManagerContext, PERMISSIONS.PROJECT_READ)
      ).toBe(true);
    });

    it("should deny permissions not assigned to the user's role", () => {
      expect(
        hasPermission(areaManagerContext, PERMISSIONS.USER_CREATE)
      ).toBe(false);
    });

    it("should give Super Admin global operational permission access", () => {
      const context: UserAccessContext = {
        role: ROLES.SUPER_ADMIN,
        rolePermissions: [],
        areaIds: [],
        branchIds: [],
      };

      expect(hasPermission(context, PERMISSIONS.USER_CREATE)).toBe(true);
      expect(hasPermission(context, PERMISSIONS.FINANCE_PAYMENT_PROCESS)).toBe(true);
    });
  });

  describe("Organizational scope checks", () => {
    it("should allow access to an assigned area", () => {
      expect(
        hasScopeAccess(areaManagerContext, "AREA", "area-A")
      ).toBe(true);
    });

    it("should deny access to an unassigned area", () => {
      expect(
        hasScopeAccess(areaManagerContext, "AREA", "area-B")
      ).toBe(false);
    });

    it("should allow direct access to an assigned branch", () => {
      expect(
        hasScopeAccess(areaManagerContext, "BRANCH", "branch-B1", "area-B")
      ).toBe(true);
    });

    it("should allow an Area Manager to access branches in their area", () => {
      expect(
        hasScopeAccess(areaManagerContext, "BRANCH", "branch-A1", "area-A")
      ).toBe(true);
    });

    it("should deny access to a branch outside assigned areas and branches", () => {
      expect(
        hasScopeAccess(areaManagerContext, "BRANCH", "branch-C1", "area-C")
      ).toBe(false);
    });

    it("should give Super Admin global scope access", () => {
      const context: UserAccessContext = {
        role: ROLES.SUPER_ADMIN,
        rolePermissions: [],
        areaIds: [],
        branchIds: [],
      };

      expect(
        hasScopeAccess(context, "AREA", "any-area")
      ).toBe(true);

      expect(
        hasScopeAccess(context, "BRANCH", "any-branch", "any-area")
      ).toBe(true);
    });
  });
});
