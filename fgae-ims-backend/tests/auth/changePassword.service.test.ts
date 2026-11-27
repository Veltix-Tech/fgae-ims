
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  userFindUnique: vi.fn(),
  credentialUpdate: vi.fn(),
  sessionUpdateMany: vi.fn(),
  verifyPassword: vi.fn(),
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
  verifyPassword: mocks.verifyPassword,
  hashPassword: mocks.hashPassword,
}));

import { changePassword } from "../../src/modules/auth/changePassword.service.js";

describe("changePassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.userFindUnique.mockResolvedValue({
      status: "ACTIVE",
      credential: {
        passwordHash: "old-hash",
      },
    });

    mocks.verifyPassword
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    mocks.hashPassword.mockResolvedValue("new-hash");

    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        userCredential: {
          update: mocks.credentialUpdate,
        },
        userSession: {
          updateMany: mocks.sessionUpdateMany,
        },
      }),
    );

    mocks.credentialUpdate.mockResolvedValue({});
    mocks.sessionUpdateMany.mockResolvedValue({ count: 2 });
  });

  it("changes the password and revokes active sessions", async () => {
    const result = await changePassword(
      "user-1",
      "Old-password-123",
      "New-password-456",
    );

    expect(result.message).toBe(
      "Password changed successfully. Please log in again.",
    );

    expect(mocks.verifyPassword).toHaveBeenNthCalledWith(
      1,
      "old-hash",
      "Old-password-123",
    );

    expect(mocks.credentialUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        data: expect.objectContaining({
          passwordHash: "new-hash",
          passwordChangedAt: expect.any(Date),
        }),
      }),
    );

    expect(mocks.sessionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-1",
          revokedAt: null,
        },
        data: {
          revokedAt: expect.any(Date),
        },
      }),
    );
  });

  it("rejects a user who does not exist", async () => {
    mocks.userFindUnique.mockResolvedValue(null);

    await expect(
      changePassword("user-1", "old-password", "new-password-123"),
    ).rejects.toThrow("Account is not eligible to change password");
  });

  it("rejects an inactive account", async () => {
    mocks.userFindUnique.mockResolvedValue({
      status: "PENDING",
      credential: { passwordHash: "old-hash" },
    });

    await expect(
      changePassword("user-1", "old-password", "new-password-123"),
    ).rejects.toThrow("Account is not eligible to change password");
  });

  it("rejects an account without credentials", async () => {
    mocks.userFindUnique.mockResolvedValue({
      status: "ACTIVE",
      credential: null,
    });

    await expect(
      changePassword("user-1", "old-password", "new-password-123"),
    ).rejects.toThrow("Account is not eligible to change password");
  });

  it("rejects an incorrect current password", async () => {
    mocks.verifyPassword.mockReset().mockResolvedValueOnce(false);

    await expect(
      changePassword("user-1", "wrong-password", "new-password-123"),
    ).rejects.toThrow("Current password is incorrect");

    expect(mocks.hashPassword).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects reusing the current password", async () => {
    mocks.verifyPassword.mockReset()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    await expect(
      changePassword(
        "user-1",
        "Old-password-123",
        "Old-password-123",
      ),
    ).rejects.toThrow(
      "New password must be different from the current password",
    );

    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects missing password values", async () => {
    await expect(
      changePassword("user-1", "", "new-password-123"),
    ).rejects.toThrow("All password fields are required");
  });
});
