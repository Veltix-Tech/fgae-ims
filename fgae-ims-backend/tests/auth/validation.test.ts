import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";

import { validate } from "../../src/middleware/validate.js";
import {
  loginSchema,
  activateSchema,
  createStaffSchema,
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


it("should accept valid staff creation information", () => {
  const { req, res, next } = createMocks({
    email: "staff@example.com",
    firstName: "Test",
    lastName: "Staff",
    roleCode: "BRANCH_MANAGER",
    organizationId: "550e8400-e29b-41d4-a716-446655440000",
    branchId: "550e8400-e29b-41d4-a716-446655440001",
  });

  validate(createStaffSchema)(req, res, next);

  expect(next).toHaveBeenCalledOnce();
  expect(res.status).not.toHaveBeenCalled();
});

it("should reject an unsupported staff role", () => {
  const { req, res, next } = createMocks({
    email: "staff@example.com",
    firstName: "Test",
    lastName: "Staff",
    roleCode: "CUSTOM_ADMIN",
    organizationId: "550e8400-e29b-41d4-a716-446655440000",
  });

  validate(createStaffSchema)(req, res, next);

  expect(res.status).toHaveBeenCalledWith(400);
  expect(next).not.toHaveBeenCalled();
});

it("should reject staff creation without an organization ID", () => {
  const { req, res, next } = createMocks({
    email: "staff@example.com",
    firstName: "Test",
    lastName: "Staff",
    roleCode: "BRANCH_MANAGER",
  });

  validate(createStaffSchema)(req, res, next);

  expect(res.status).toHaveBeenCalledWith(400);
  expect(next).not.toHaveBeenCalled();
});

});