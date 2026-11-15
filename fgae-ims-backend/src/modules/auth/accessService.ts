
import {
  hasPermission,
  hasScopeAccess,
  type UserAccessContext,
} from "./accessPolicy.js";

import type { Permission } from "./permissions.js";
import type { PermissionChecker } from "../../middleware/authorize.js";
import type { ScopeChecker } from "../../middleware/authorizeScope.js";

/**
 * Loads trusted access information for a user.
 * The implementation will eventually retrieve this from Prisma.
 */
export type AccessContextLoader = (
  userId: string
) => Promise<UserAccessContext | null>;

/**
 * Resolves the parent area of a branch.
 * Returns null when the branch does not exist.
 */
export type BranchAreaLoader = (
  branchId: string
) => Promise<string | null>;

/**
 * Creates a permission checker for authorization middleware.
 */
export const createPermissionChecker = (
  loadAccessContext: AccessContextLoader
): PermissionChecker => {
  return async (userId: string, permission: Permission) => {
    const context = await loadAccessContext(userId);

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
  loadAccessContext: AccessContextLoader,
  loadBranchArea: BranchAreaLoader
): ScopeChecker => {
  return async (userId, resourceId, resourceType) => {
    const context = await loadAccessContext(userId);

    if (!context) {
      return false;
    }

    if (resourceType === "AREA") {
      return hasScopeAccess(
        context,
        "AREA",
        resourceId
      );
    }

    const areaId = await loadBranchArea(resourceId);

    // Do not grant access to a branch that cannot be found.
    if (!areaId) {
      return false;
    }

    return hasScopeAccess(
      context,
      "BRANCH",
      resourceId,
      areaId
    );
  };
};
