
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  userFindUnique: vi.fn(),
  tokenUpdateMany: vi.fn(),
  tokenCreate: vi.fn(),
  tokenFindFirst: vi.fn(),
  credentialUpdate: vi.fn(),
  sessionUpdateMany: vi.fn(),
  hashPassword: vi.fn(),
}));

vi.mock("../../src/config/db.js", () => ({
  default: {
    user: {
      findUnique: mocks.userFindUnique,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("../../src/utils/password.js", () => ({
  hashPassword: mocks.hashPassword,
}));

import { ActivationPurpose } from "@prisma/client";
import {
  createPasswordResetRequest,
  resetPassword,
} from "../../src/modules/auth/passwordReset.service.js";
import { hashActivationToken } from "../../src/utils/activationToken.js";

const tx = {
  accountActivationToken: {
    updateMany: mocks.tokenUpdateMany,
    create: mocks.tokenCreate,
    findFirst: mocks.tokenFindFirst,
  },
  userCredential: {
    update: mocks.credentialUpdate,
  },
  userSession: {
    updateMany: mocks.sessionUpdateMany,
  },
};

describe("createPasswordResetRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.transaction.mockImplementation(
      async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
    );

    mocks.userFindUnique.mockResolvedValue({
      id: "user-1",
      email: "staff@example.com",
      status: "ACTIVE",
      credential: { id: "credential-1" },
    });

    mocks.tokenUpdateMany.mockResolvedValue({ count: 0 });
    mocks.tokenCreate.mockResolvedValue({ id: "token-1" });
  });

  it("creates a reset token for an eligible account", async () => {
    const result = await createPasswordResetRequest(
      " STAFF@EXAMPLE.COM ",
    );

    expect(result).not.toBeNull();
    expect(result?.email).toBe("staff@example.com");
    expect(result?.token).toMatch(/^[a-f0-9]{64}$/);
    expect(result?.expiresAt.getTime()).toBeGreaterThan(Date.now());

    expect(mocks.userFindUnique).toHaveBeenCalledWith({
      where: { email: "staff@example.com" },
      select: expect.any(Object),
    });

    expect(mocks.tokenCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        purpose: ActivationPurpose.PASSWORD_RESET,
        tokenHash: hashActivationToken(result!.token),
      }),
    });
  });

  it("invalidates previous unused password-reset tokens", async () => {
    await createPasswordResetRequest("staff@example.com");

    expect(mocks.tokenUpdateMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        purpose: ActivationPurpose.PASSWORD_RESET,
        usedAt: null,
      },
      data: {
        usedAt: expect.any(Date),
      },
    });
  });

  it("returns null when the account does not exist", async () => {
    mocks.userFindUnique.mockResolvedValue(null);

    const result = await createPasswordResetRequest(
      "missing@example.com",
    );

    expect(result).toBeNull();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("returns null for a non-active account", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: "user-1",
      email: "staff@example.com",
      status: "PENDING",
      credential: { id: "credential-1" },
    });

    const result = await createPasswordResetRequest(
      "staff@example.com",
    );

    expect(result).toBeNull();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("returns null when the account has no credential", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: "user-1",
      email: "staff@example.com",
      status: "ACTIVE",
      credential: null,
    });

    const result = await createPasswordResetRequest(
      "staff@example.com",
    );

    expect(result).toBeNull();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe("resetPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.transaction.mockImplementation(
      async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
    );

    mocks.hashPassword.mockResolvedValue("new-argon2-hash");

    mocks.tokenFindFirst.mockResolvedValue({
      id: "reset-token-1",
      userId: "user-1",
      user: {
        id: "user-1",
        status: "ACTIVE",
        credential: { id: "credential-1" },
      },
    });

    mocks.tokenUpdateMany.mockResolvedValue({ count: 1 });
    mocks.credentialUpdate.mockResolvedValue({});
    mocks.sessionUpdateMany.mockResolvedValue({ count: 2 });
  });

  it("resets the password and revokes active sessions", async () => {
    const result = await resetPassword(
      "valid-reset-token",
      "NewSecurePassword123!",
    );

    expect(result).toEqual({
      message: "Password reset successfully",
    });

    expect(mocks.tokenFindFirst).toHaveBeenCalledWith({
      where: {
        tokenHash: hashActivationToken("valid-reset-token"),
        purpose: ActivationPurpose.PASSWORD_RESET,
        usedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      select: expect.any(Object),
    });

    expect(mocks.credentialUpdate).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: {
        passwordHash: "new-argon2-hash",
        passwordChangedAt: expect.any(Date),
      },
    });

    expect(mocks.sessionUpdateMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
  });

  it("rejects an invalid or expired token", async () => {
    mocks.tokenFindFirst.mockResolvedValue(null);

    await expect(
      resetPassword("invalid-token", "NewSecurePassword123!"),
    ).rejects.toThrow("Invalid or expired password reset token");

    expect(mocks.credentialUpdate).not.toHaveBeenCalled();
    expect(mocks.sessionUpdateMany).not.toHaveBeenCalled();
  });

  it("rejects a non-active account", async () => {
    mocks.tokenFindFirst.mockResolvedValue({
      id: "reset-token-1",
      userId: "user-1",
      user: {
        id: "user-1",
        status: "PENDING",
        credential: { id: "credential-1" },
      },
    });

    await expect(
      resetPassword("valid-reset-token", "NewSecurePassword123!"),
    ).rejects.toThrow("Invalid or expired password reset token");

    expect(mocks.credentialUpdate).not.toHaveBeenCalled();
  });

  it("rejects when the account has no credential", async () => {
    mocks.tokenFindFirst.mockResolvedValue({
      id: "reset-token-1",
      userId: "user-1",
      user: {
        id: "user-1",
        status: "ACTIVE",
        credential: null,
      },
    });

    await expect(
      resetPassword("valid-reset-token", "NewSecurePassword123!"),
    ).rejects.toThrow("Invalid or expired password reset token");

    expect(mocks.credentialUpdate).not.toHaveBeenCalled();
  });

  it("rejects when the token cannot be consumed", async () => {
    mocks.tokenUpdateMany.mockResolvedValue({ count: 0 });

    await expect(
      resetPassword("already-used-token", "NewSecurePassword123!"),
    ).rejects.toThrow("Invalid or expired password reset token");

    expect(mocks.credentialUpdate).not.toHaveBeenCalled();
    expect(mocks.sessionUpdateMany).not.toHaveBeenCalled();
  });

  it("requires a token and password", async () => {
    await expect(
      resetPassword("", "NewSecurePassword123!"),
    ).rejects.toThrow("Token and password are required");

    await expect(
      resetPassword("valid-token", ""),
    ).rejects.toThrow("Token and password are required");

    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
