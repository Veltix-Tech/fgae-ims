
import type {
  Request,
  RequestHandler,
} from "express";

// Types of organizational resources
export type ScopeResourceType = "AREA" | "BRANCH";

// Function responsible for checking organizational access
export type ScopeChecker = (
  userId: string,
  resourceId: string,
  resourceType: ScopeResourceType
) => Promise<boolean>;

// Middleware factory for organizational scope checking
export const authorizeScope = (
  resourceType: ScopeResourceType,
  getResourceId: (req: Request) => string | undefined,
  checkScope: ScopeChecker
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

    // Get the resource ID from the request
    const resourceId = getResourceId(req);

    if (!resourceId) {
      res.status(400).json({
        status: "error",
        message: "Resource ID is required",
      });
      return;
    }

    try {
      // Check whether the resource belongs to the user's scope
      const hasAccess = await checkScope(
        userId,
        resourceId,
        resourceType
      );

      if (!hasAccess) {
        res.status(403).json({
          status: "error",
          message: "You cannot access this organizational resource",
        });
        return;
      }

      next();
    } catch {
      res.status(500).json({
        status: "error",
        message: "Unable to verify organizational access",
      });
    }
  };
};
