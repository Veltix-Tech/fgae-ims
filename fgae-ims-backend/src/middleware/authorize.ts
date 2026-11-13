
import type { RequestHandler } from "express";
import type { Permission } from "../modules/auth/permissions.js";

// A function that checks whether a user has a permission.
// Later, this will check the database.
export type PermissionChecker = (
  userId: string,
  permission: Permission
) => Promise<boolean>;

// Middleware factory for checking permissions
export const authorize = (
  requiredPermission: Permission,
  checkPermission: PermissionChecker
): RequestHandler => {
  return async (req, res, next) => {
    // Make sure the user is authenticated
    const userId = req.auth?.userId;

    if (!userId) {
      res.status(401).json({
        status: "error",
        message: "Authentication required",
      });
      return;
    }

    try {
      // Check whether the user has the required permission
      const hasPermission = await checkPermission(
        userId,
        requiredPermission
      );

      if (!hasPermission) {
        res.status(403).json({
          status: "error",
          message: "You do not have permission to perform this action",
        });
        return;
      }

      // Permission granted: continue to the next middleware
      next();
    } catch {
      res.status(500).json({
        status: "error",
        message: "Unable to verify permissions",
      });
    }
  };
};
