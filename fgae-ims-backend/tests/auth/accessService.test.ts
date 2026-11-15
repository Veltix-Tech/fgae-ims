
import { describe, it, expect, vi } from "vitest";

import {
  createPermissionChecker,
  createScopeChecker,
} from "../../src/modules/auth/accessService.js";

import type { UserAccessContext } from "../../src/modules/auth/accessPolicy.js";

import { ROLES } from "../../src/modules/auth/rolePermissions.js";
import { PERMISSIONS } from "../../src/modules/auth/permissions.js";

const areaManagerContext: UserAccessContext = {
  role: ROLES.AREA_MANAGER,
  rolePermissions: [
    PERMISSIONS.PROJECT_READ,
    PERMISSIONS.USER_READ,
  ],
  areaIds: ["area-A"],
  branchIds: [],
};

describe("Access service", () => {
  describe("Permission checker", () => {
    it("should allow a permission inherited from the user's role", async () => {
      const loadContext = vi.fn().mockResolvedValue(areaManagerContext);
      const checkPermission = createPermissionChecker(loadContext);

      await expect(
        checkPermission("user-123", PERMISSIONS.PROJECT_READ)
      ).resolves.toBe(true);
    });

    it("should allow another permission included in the user's role", async () => {
      const loadContext = vi.fn().mockResolvedValue(areaManagerContext);
      const checkPermission = createPermissionChecker(loadContext);

      await expect(
        checkPermission("user-123", PERMISSIONS.USER_READ)
      ).resolves.toBe(true);
    });

    it("should deny permissions not included in the user's role", async () => {
      const loadContext = vi.fn().mockResolvedValue(areaManagerContext);
      const checkPermission = createPermissionChecker(loadContext);

      await expect(
        checkPermission("user-123", PERMISSIONS.USER_CREATE)
      ).resolves.toBe(false);
    });

    it("should deny access when the user context does not exist", async () => {
      const loadContext = vi.fn().mockResolvedValue(null);
      const checkPermission = createPermissionChecker(loadContext);

      await expect(
        checkPermission("unknown-user", PERMISSIONS.PROJECT_READ)
      ).resolves.toBe(false);
    });

    it("should propagate access-context loading errors", async () => {
      const loadContext = vi.fn().mockRejectedValue(
        new Error("Database unavailable")
      );

      const checkPermission = createPermissionChecker(loadContext);

      await expect(
        checkPermission("user-123", PERMISSIONS.PROJECT_READ)
      ).rejects.toThrow("Database unavailable");
    });

    it("should give Super Admin global operational permission access", async () => {
      const superAdminContext: UserAccessContext = {
        role: ROLES.SUPER_ADMIN,
        rolePermissions: [],
        areaIds: [],
        branchIds: [],
      };

      const loadContext = vi.fn().mockResolvedValue(superAdminContext);
      const checkPermission = createPermissionChecker(loadContext);

      await expect(
        checkPermission("admin-123", PERMISSIONS.USER_CREATE)
      ).resolves.toBe(true);
    });
  });

  describe("Scope checker", () => {
    it("should allow access to a branch inside the user's area", async () => {
      const loadContext = vi.fn().mockResolvedValue(areaManagerContext);
      const loadBranchArea = vi.fn().mockResolvedValue("area-A");

      const checkScope = createScopeChecker(loadContext, loadBranchArea);

      await expect(
        checkScope("user-123", "branch-A1", "BRANCH")
      ).resolves.toBe(true);
    });

    it("should deny access to a branch outside the user's area", async () => {
      const loadContext = vi.fn().mockResolvedValue(areaManagerContext);
      const loadBranchArea = vi.fn().mockResolvedValue("area-B");

      const checkScope = createScopeChecker(loadContext, loadBranchArea);

      await expect(
        checkScope("user-123", "branch-B1", "BRANCH")
      ).resolves.toBe(false);
    });

    it("should deny access when the branch does not exist", async () => {
      const loadContext = vi.fn().mockResolvedValue(areaManagerContext);
      const loadBranchArea = vi.fn().mockResolvedValue(null);

      const checkScope = createScopeChecker(loadContext, loadBranchArea);

      await expect(
        checkScope("user-123", "unknown-branch", "BRANCH")
      ).resolves.toBe(false);
    });

    it("should check direct area assignments", async () => {
      const loadContext = vi.fn().mockResolvedValue(areaManagerContext);
      const loadBranchArea = vi.fn();

      const checkScope = createScopeChecker(loadContext, loadBranchArea);

      await expect(
        checkScope("user-123", "area-A", "AREA")
      ).resolves.toBe(true);

      expect(loadBranchArea).not.toHaveBeenCalled();
    });

    it("should deny access when the user context does not exist", async () => {
      const loadContext = vi.fn().mockResolvedValue(null);
      const loadBranchArea = vi.fn();

      const checkScope = createScopeChecker(loadContext, loadBranchArea);

      await expect(
        checkScope("unknown-user", "branch-A1", "BRANCH")
      ).resolves.toBe(false);

      expect(loadBranchArea).not.toHaveBeenCalled();
    });

    it("should propagate branch lookup errors", async () => {
      const loadContext = vi.fn().mockResolvedValue(areaManagerContext);
      const loadBranchArea = vi.fn().mockRejectedValue(
        new Error("Database unavailable")
      );

      const checkScope = createScopeChecker(loadContext, loadBranchArea);

      await expect(
        checkScope("user-123", "branch-A1", "BRANCH")
      ).rejects.toThrow("Database unavailable");
    });
  });
});
