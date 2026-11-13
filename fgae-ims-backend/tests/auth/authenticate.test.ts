import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { authenticate } from "../../src/middleware/authenticate.js";
import { generateAccessToken } from "../../src/utils/token.js";

describe("Authentication middleware", () => {
  let req: Request;
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET =
      "test-secret-for-fgae-ims-automated-tests-123456";

    req = {
      headers: {},
    } as Request;

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    next = vi.fn();
  });

  it("should reject requests without a token", () => {
    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("should reject invalid tokens", () => {
    req.headers.authorization = "Bearer invalid-token";

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("should accept valid tokens", () => {
    const token = generateAccessToken("user-123");
    req.headers.authorization = `Bearer ${token}`;

    authenticate(req, res, next);

    expect(req.auth?.userId).toBe("user-123");
    expect(next).toHaveBeenCalledOnce();
  });

  it("should reject incorrect authorization format", () => {
    req.headers.authorization = "Basic some-token";

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});