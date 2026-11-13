
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
  authorizeScope,
} from "../../src/middleware/authorizeScope.js";

describe("Organizational scope middleware", () => {
  let req: Request;
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      headers: {},
      params: {
        branchId: "branch-A",
      },
      auth: {
        userId: "user-123",
      },
    } as unknown as Request;

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    next = vi.fn();
  });

  it("should allow access within the user's scope", async () => {
    const checkScope = vi.fn().mockResolvedValue(true);

    const middleware = authorizeScope(
      "BRANCH",
      (req) => req.params.branchId,
      checkScope
    );

    await middleware(req, res, next);

    expect(checkScope).toHaveBeenCalledWith(
      "user-123",
      "branch-A",
      "BRANCH"
    );

    expect(next).toHaveBeenCalledOnce();
  });

  it("should reject access outside the user's scope", async () => {
    const checkScope = vi.fn().mockResolvedValue(false);

    const middleware = authorizeScope(
      "BRANCH",
      (req) => req.params.branchId,
      checkScope
    );

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("should reject unauthenticated users", async () => {
    req.auth = undefined;

    const checkScope = vi.fn();

    const middleware = authorizeScope(
      "BRANCH",
      (req) => req.params.branchId,
      checkScope
    );

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(checkScope).not.toHaveBeenCalled();
  });

  it("should reject requests without a resource ID", async () => {
    req.params = {};

    const checkScope = vi.fn();

    const middleware = authorizeScope(
      "BRANCH",
      (req) => req.params.branchId,
      checkScope
    );

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(checkScope).not.toHaveBeenCalled();
  });

  it("should handle scope-checking failures", async () => {
    const checkScope = vi.fn().mockRejectedValue(
      new Error("Database error")
    );

    const middleware = authorizeScope(
      "BRANCH",
      (req) => req.params.branchId,
      checkScope
    );

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});
