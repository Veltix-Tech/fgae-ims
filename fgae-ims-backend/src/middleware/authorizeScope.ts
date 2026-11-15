import type { Request, RequestHandler } from "express";
import { AppError } from "../utils/AppError.js";

export type ScopeResourceType = "AREA" | "BRANCH";

export type ScopeChecker = (
  userId: string,
  resourceId: string,
  resourceType: ScopeResourceType
) => Promise<boolean>;

export const authorizeScope = (
  resourceType: ScopeResourceType,
  getResourceId: (req: Request) => string | undefined,
  checkScope: ScopeChecker
): RequestHandler => {
  return async (req, res, next) => {
    const userId = req.auth?.userId;

    if (!userId) {
      return next(new AppError("Authentication required", 401));
    }

    const resourceId = getResourceId(req);

    if (!resourceId) {
      return next(new AppError("Resource ID is required", 400));
    }

    try {
      const hasAccess = await checkScope(
        userId,
        resourceId,
        resourceType
      );

      if (!hasAccess) {
        return next(
          new AppError(
            "You cannot access this organizational resource",
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