import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";

import { validate } from "../../src/middleware/validate.js";
import {
  loginSchema,
  activateSchema,
} from "../../src/modules/auth/auth.validation.js";

describe("Validation middleware", () => {
  const createMocks = (body: unknown) => {
    const req = { body } as Request;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    const next = vi.fn() as NextFunction;

    return { req, res, next };
  };

  it("should accept valid login information", () => {
    const { req, res, next } = createMocks({
      email: "user@example.com",
      password: "Password123!",
    });

    validate(loginSchema)(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should reject an invalid email", () => {
    const { req, res, next } = createMocks({
      email: "invalid-email",
      password: "Password123!",
    });

    validate(loginSchema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it("should reject a missing password", () => {
    const { req, res, next } = createMocks({
      email: "user@example.com",
    });

    validate(loginSchema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it("should reject a weak activation password", () => {
    const { req, res, next } = createMocks({
      activationToken: "activation-token",
      password: "weak123",
    });

    validate(activateSchema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });
});