
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

const prismaMock = vi.hoisted(() => ({
  userSession: {
    findUnique: vi.fn(),
  },
}));

vi.mock("../../src/config/db.js", () => ({
  default: prismaMock,
}));

import { authenticate } from "../../src/middleware/authenticate.js";
import { AppError } from "../../src/utils/AppError.js";
import { generateAccessToken } from "../../src/utils/token.js";

describe("Authentication middleware", () => {
  const createMocks = (authorization?: string) => {
    const req = {
      headers: authorization
        ? { authorization }
        : {},
    } as unknown as Request;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    const next = vi.fn();

    return { req, res, next };
  };

  const activeSession = {
    id: "session-123",
    userId: "user-123",
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    user: {
      status: "ACTIVE",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    process.env.JWT_ACCESS_SECRET =
      "test-secret-for-fgae-ims-automated-tests-123456";
  });

  it("should reject requests without a token", async () => {
    const { req, res, next } = createMocks();

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledOnce();

    const error = next.mock.calls[0][0] as AppError;

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe("Authentication required");
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should reject invalid tokens", async () => {
    const { req, next } = createMocks("Bearer invalid-token");

    await authenticate(req, {} as Response, next);

    expect(next).toHaveBeenCalledOnce();

    const error = next.mock.calls[0][0] as AppError;

    expect(error.statusCode).toBe(401);
    expect(error.message).toBe("Invalid or expired access token");
    expect(prismaMock.userSession.findUnique).not.toHaveBeenCalled();
  });

  it("should accept a valid token with an active session", async () => {
    prismaMock.userSession.findUnique.mockResolvedValue(activeSession);

    const token = generateAccessToken("user-123", "session-123");

    const { req, next } = createMocks(`Bearer ${token}`);

    await authenticate(req, {} as Response, next);

    expect(prismaMock.userSession.findUnique).toHaveBeenCalledWith({
      where: {
        id: "session-123",
      },
      select: expect.any(Object),
    });

    expect(req.auth).toEqual({
      userId: "user-123",
      sessionId: "session-123",
    });

    expect(req.userId).toBe("user-123");
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });

  it("should reject a session that does not exist", async () => {
    prismaMock.userSession.findUnique.mockResolvedValue(null);

    const token = generateAccessToken("user-123", "missing-session");

    const { req, next } = createMocks(`Bearer ${token}`);

    await authenticate(req, {} as Response, next);

    expect(next).toHaveBeenCalledOnce();

    const error = next.mock.calls[0][0] as AppError;

    expect(error.statusCode).toBe(401);
    expect(error.message).toBe("Session is invalid or has expired");
  });

  it("should reject a revoked session", async () => {
    prismaMock.userSession.findUnique.mockResolvedValue({
      ...activeSession,
      revokedAt: new Date(),
    });

    const token = generateAccessToken("user-123", "session-123");

    const { req, next } = createMocks(`Bearer ${token}`);

    await authenticate(req, {} as Response, next);

    const error = next.mock.calls[0][0] as AppError;

    expect(error.statusCode).toBe(401);
    expect(error.message).toBe("Session is invalid or has expired");
  });

  it("should reject an expired session", async () => {
    prismaMock.userSession.findUnique.mockResolvedValue({
      ...activeSession,
      expiresAt: new Date(Date.now() - 60_000),
    });

    const token = generateAccessToken("user-123", "session-123");

    const { req, next } = createMocks(`Bearer ${token}`);

    await authenticate(req, {} as Response, next);

    const error = next.mock.calls[0][0] as AppError;

    expect(error.statusCode).toBe(401);
    expect(error.message).toBe("Session is invalid or has expired");
  });

  it("should reject a session belonging to another user", async () => {
    prismaMock.userSession.findUnique.mockResolvedValue({
      ...activeSession,
      userId: "another-user",
    });

    const token = generateAccessToken("user-123", "session-123");

    const { req, next } = createMocks(`Bearer ${token}`);

    await authenticate(req, {} as Response, next);

    const error = next.mock.calls[0][0] as AppError;

    expect(error.statusCode).toBe(401);
    expect(error.message).toBe("Session is invalid or has expired");
  });

  it("should reject an inactive user", async () => {
    prismaMock.userSession.findUnique.mockResolvedValue({
      ...activeSession,
      user: {
        status: "SUSPENDED",
      },
    });

    const token = generateAccessToken("user-123", "session-123");

    const { req, next } = createMocks(`Bearer ${token}`);

    await authenticate(req, {} as Response, next);

    const error = next.mock.calls[0][0] as AppError;

    expect(error.statusCode).toBe(401);
    expect(error.message).toBe("Session is invalid or has expired");
  });

  it("should reject an incorrect authorization format", async () => {
    const { req, res, next } = createMocks("Basic some-token");

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledOnce();

    const error = next.mock.calls[0][0] as AppError;

    expect(error.statusCode).toBe(401);
    expect(error.message).toBe("Invalid authorization format");
  });
});
