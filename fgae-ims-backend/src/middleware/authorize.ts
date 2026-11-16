import type { RequestHandler } from "express";
import type { Permission } from "../modules/auth/permissions.js";
import { AppError } from "../utils/AppError.js";

export type PermissionChecker = (
  userId: string,
  permission: Permission
) => Promise<boolean>;

export const authorize = (
  requiredPermission: Permission,
  checkPermission: PermissionChecker
): RequestHandler => {
  return async (req, res, next) => {
    const userId = req.auth?.userId;

    if (!userId) {
      return next(new AppError("Authentication required", 401));
    }

    try {
      const hasPermission = await checkPermission(
        userId,
        requiredPermission
      );

      if (!hasPermission) {
        return next(
          new AppError(
            "You do not have permission to perform this action",
            403
          )
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};