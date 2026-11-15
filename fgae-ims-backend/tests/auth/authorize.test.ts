import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

import { authorize } from "../../src/middleware/authorize.js";
import { PERMISSIONS } from "../../src/modules/auth/permissions.js";
import { AppError } from "../../src/utils/AppError.js";

describe("Authorization middleware", () => {
  let req: Request;
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      headers: {},
      auth: { userId: "user-123" },
    } as Request;

    res = {} as Response;
    next = vi.fn();
  });

  it("should allow a user with the required permission", async () => {
    const checkPermission = vi.fn().mockResolvedValue(true);

    const middleware = authorize(
      PERMISSIONS.VOLUNTEER_APPROVE,
      checkPermission
    );

    await middleware(req, res, next);

    expect(checkPermission).toHaveBeenCalledWith(
      "user-123",
      PERMISSIONS.VOLUNTEER_APPROVE
    );
    expect(next).toHaveBeenCalledWith();
  });

  it("should reject a user without the required permission", async () => {
    const checkPermission = vi.fn().mockResolvedValue(false);

    const middleware = authorize(
      PERMISSIONS.VOLUNTEER_APPROVE,
      checkPermission
    );

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        message: "You do not have permission to perform this action",
      })
    );
  });

  it("should reject unauthenticated users", async () => {
    req.auth = undefined;

    const checkPermission = vi.fn();

    const middleware = authorize(
      PERMISSIONS.VOLUNTEER_APPROVE,
      checkPermission
    );

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
      })
    );

    expect(checkPermission).not.toHaveBeenCalled();
  });

  it("should forward permission checking errors", async () => {
    const error = new Error("Database error");

    const checkPermission = vi.fn().mockRejectedValue(error);

    const middleware = authorize(
      PERMISSIONS.VOLUNTEER_APPROVE,
      checkPermission
    );

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});