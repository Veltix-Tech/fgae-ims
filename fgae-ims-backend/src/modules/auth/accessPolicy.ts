
import { ROLES } from "./rolePermissions.js";
import type { Permission } from "./permissions.js";

/**
 * Access information loaded from trusted database records.
 * Never build this context from request body values.
 */
export interface UserAccessContext {
  role: string;

  // Permissions inherited from the user's predefined role.
  rolePermissions: readonly Permission[];

  // Organizational assignments.
  areaIds: readonly string[];
  branchIds: readonly string[];
}

/**
 * Checks whether a user has a particular permission.
 *
 * Super Admin has global operational access.
 * Other users receive permissions only through their assigned role.
 */
export const hasPermission = (
  context: UserAccessContext,
  requiredPermission: Permission
): boolean => {
  if (context.role === ROLES.SUPER_ADMIN) {
    return true;
  }

  return context.rolePermissions.includes(requiredPermission);
};

/**
 * Checks whether a user can access an area or branch.
 *
 * Area assignment gives access to that area and its branches.
 * Branch assignment gives access only to that branch.
 *
 * For branch checks, resourceAreaId must come from the database,
 * not from request body or query parameters.
 */
export const hasScopeAccess = (
  context: UserAccessContext,
  resourceType: "AREA" | "BRANCH",
  resourceId: string,
  resourceAreaId?: string
): boolean => {
  if (context.role === ROLES.SUPER_ADMIN) {
    return true;
  }

  if (resourceType === "AREA") {
    return context.areaIds.includes(resourceId);
  }

  const hasDirectBranchAccess =
    context.branchIds.includes(resourceId);

  const hasInheritedAreaAccess =
    resourceAreaId !== undefined &&
    context.areaIds.includes(resourceAreaId);

  return hasDirectBranchAccess || hasInheritedAreaAccess;
};
