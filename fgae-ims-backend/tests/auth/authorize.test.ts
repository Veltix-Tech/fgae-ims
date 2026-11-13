
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
} from "vitest";

import type {
  Request,
  Response,
  NextFunction,
} from "express";

import {
  authorize,
} from "../../src/middleware/authorize.js";

import {
  PERMISSIONS,
} from "../../src/modules/auth/permissions.js";

describe("Authorization middleware", () => {
  let req: Request;
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      headers: {},
      auth: {
        userId: "user-123",
      },
    } as Request;

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

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

    expect(next).toHaveBeenCalledOnce();
  });

  it("should reject a user without the required permission", async () => {
    const checkPermission = vi.fn().mockResolvedValue(false);

    const middleware = authorize(
      PERMISSIONS.VOLUNTEER_APPROVE,
      checkPermission
    );

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("should reject unauthenticated users", async () => {
    req.auth = undefined;

    const checkPermission = vi.fn();

    const middleware = authorize(
      PERMISSIONS.VOLUNTEER_APPROVE,
      checkPermission
    );

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(checkPermission).not.toHaveBeenCalled();
  });

  it("should return an error if permission checking fails", async () => {
    const checkPermission = vi.fn().mockRejectedValue(
      new Error("Database error")
    );

    const middleware = authorize(
      PERMISSIONS.VOLUNTEER_APPROVE,
      checkPermission
    );

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});
