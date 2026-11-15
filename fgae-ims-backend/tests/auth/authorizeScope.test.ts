import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

import { authorizeScope } from "../../src/middleware/authorizeScope.js";

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

    res = {} as Response;
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

    expect(next).toHaveBeenCalledWith();
  });

  it("should reject access outside the user's scope", async () => {
    const checkScope = vi.fn().mockResolvedValue(false);

    const middleware = authorizeScope(
      "BRANCH",
      (req) => req.params.branchId,
      checkScope
    );

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
      })
    );
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

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
      })
    );

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

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
      })
    );

    expect(checkScope).not.toHaveBeenCalled();
  });

  it("should forward scope-checking errors", async () => {
    const error = new Error("Database error");

    const checkScope = vi.fn().mockRejectedValue(error);

    const middleware = authorizeScope(
      "BRANCH",
      (req) => req.params.branchId,
      checkScope
    );

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});