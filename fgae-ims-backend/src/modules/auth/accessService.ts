
import prisma from "../../config/db.js";

import {
  hasPermission,
  hasScopeAccess,
  type UserAccessContext,
} from "./accessPolicy.js";

import {
  PERMISSION_CATALOG,
  type Permission,
} from "./permissions.js";

import type { PermissionChecker } from "../../middleware/authorize.js";
import type { ScopeChecker } from "../../middleware/authorizeScope.js";

const validPermissionKeys = new Set<string>(
  PERMISSION_CATALOG.map((permission) => permission.key),
);

/**
 * Loads the user's current, trusted access information from the database.
 * Inactive users and users without exactly one active role are denied.
 */
export const loadAccessContext = async (
  userId: string,
): Promise<UserAccessContext | null> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      status: true,
      roleAssignments: {
        where: { revokedAt: null },
        select: {
          role: {
            select: {
              code: true,
              permissions: {
                select: {
                  permission: {
                    select: {
                      key: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      assignments: {
        where: { revokedAt: null },
        select: {
          areaId: true,
          branchId: true,
        },
      },
    },
  });

  if (!user || user.status !== "ACTIVE") {
    return null;
  }

  // Enforce the one-active-role rule when loading access.
  if (user.roleAssignments.length !== 1) {
    return null;
  }

  const activeRoleAssignment = user.roleAssignments[0];

if (!activeRoleAssignment) {
  return null;
}

const activeRole = activeRoleAssignment.role;

  const rolePermissions = activeRole.permissions
    .map((item) => item.permission.key)
    .filter((key): key is Permission => validPermissionKeys.has(key));

  return {
    role: activeRole.code,
    rolePermissions,
    areaIds: [
      ...new Set(
        user.assignments
          .map((assignment) => assignment.areaId)
          .filter((id): id is string => id !== null),
      ),
    ],
    branchIds: [
      ...new Set(
        user.assignments
          .map((assignment) => assignment.branchId)
          .filter((id): id is string => id !== null),
      ),
    ],
  };
};

/**
 * Finds the area containing a branch.
 * Returns null if the branch does not exist.
 */
export const loadBranchArea = async (
  branchId: string,
): Promise<string | null> => {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { areaId: true },
  });

  return branch?.areaId ?? null;
};

/**
 * Creates a permission checker for authorization middleware.
 */
export const createPermissionChecker = (
  loadContext: (userId: string) => Promise<UserAccessContext | null> =
    loadAccessContext,
): PermissionChecker => {
  return async (userId, permission) => {
    const context = await loadContext(userId);

    if (!context) {
      return false;
    }

    return hasPermission(context, permission);
  };
};

/**
 * Creates an organizational scope checker.
 */
export const createScopeChecker = (
  loadContext: (userId: string) => Promise<UserAccessContext | null> =
    loadAccessContext,
  getBranchArea: (branchId: string) => Promise<string | null> =
    loadBranchArea,
): ScopeChecker => {
  return async (userId, resourceId, resourceType) => {
    const context = await loadContext(userId);

    if (!context) {
      return false;
    }

    if (resourceType === "AREA") {
      return hasScopeAccess(context, "AREA", resourceId);
    }

    const areaId = await getBranchArea(resourceId);

    if (!areaId) {
      return false;
    }

    return hasScopeAccess(
      context,
      "BRANCH",
      resourceId,
      areaId,
    );
  };
};

// Application-wide database-backed authorization checkers.
export const permissionChecker = createPermissionChecker();

export const scopeChecker = createScopeChecker();