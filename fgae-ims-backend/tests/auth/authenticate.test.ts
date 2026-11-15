
import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { authenticate } from "../../src/middleware/authenticate.js";
import { AppError } from "../../src/utils/AppError.js";
import { generateAccessToken } from "../../src/utils/token.js";

describe("Authentication middleware", () => {
  const createMocks = (authorization?: string) => {
    const req = {
      headers: authorization
        ? { authorization }
        : {},
    } as Request;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    const next = vi.fn() as NextFunction;

    return { req, res, next };
  };

  it("should reject requests without a token", () => {
    const { req, res, next } = createMocks();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledOnce();

    const error = next.mock.calls[0][0] as AppError;

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe("Authentication required");
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should reject invalid tokens", () => {
    const { req, res, next } = createMocks("Bearer invalid-token");

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledOnce();

    const error = next.mock.calls[0][0] as AppError;

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe("Invalid or expired access token");
  });

  it("should accept valid tokens", () => {
    const token = generateAccessToken("user-123");
    const { req, next } = createMocks(`Bearer ${token}`);

    authenticate(req, {} as Response, next);

    expect(req.auth).toEqual({
      userId: "user-123",
    });

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });

  it("should reject incorrect authorization format", () => {
    const { req, res, next } = createMocks("Basic some-token");

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledOnce();

    const error = next.mock.calls[0][0] as AppError;

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe("Invalid authorization format");
  });
});
