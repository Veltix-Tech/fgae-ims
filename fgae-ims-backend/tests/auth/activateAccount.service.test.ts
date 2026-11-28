
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  tokenFindFirst: vi.fn(),
  tokenUpdateMany: vi.fn(),
  userCredentialCreate: vi.fn(),
  userUpdate: vi.fn(),
  hashPassword: vi.fn(),
}));

vi.mock("../../src/config/db.js", () => ({
  default: {
    $transaction: mocks.transaction,
  },
}));

vi.mock("../../src/utils/password.js", () => ({
  hashPassword: mocks.hashPassword,
  verifyPassword: vi.fn(),
}));

import { activateAccount } from "../../src/modules/auth/activation.service.js";
import { hashActivationToken } from "../../src/utils/activationToken.js";

const tx = {
  accountActivationToken: {
    findFirst: mocks.tokenFindFirst,
    updateMany: mocks.tokenUpdateMany,
  },
  userCredential: {
    create: mocks.userCredentialCreate,
  },
  user: {
    update: mocks.userUpdate,
  },
};

const validInvitation = {
  id: "invitation-1",
  userId: "user-1",
  user: {
    id: "user-1",
    status: "PENDING",
  },
};

describe("activateAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.transaction.mockImplementation(
      async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
    );

    mocks.hashPassword.mockResolvedValue("hashed-password");

    mocks.tokenFindFirst.mockResolvedValue(validInvitation);

    mocks.tokenUpdateMany.mockResolvedValue({
      count: 1,
    });

    mocks.userCredentialCreate.mockResolvedValue({
      userId: "user-1",
    });

    mocks.userUpdate.mockResolvedValue({
      id: "user-1",
      email: "staff@example.com",
      firstName: "Staff",
      lastName: "Member",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
    });
  });

  it("activates a pending account with a valid invitation", async () => {
    const result = await activateAccount(
      "valid-activation-token",
      "StrongPassword123!",
    );

    expect(result.message).toBe(
      "Account activated successfully",
    );

    expect(result.user.status).toBe("ACTIVE");

    expect(mocks.userCredentialCreate).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        passwordHash: "hashed-password",
        passwordChangedAt: expect.any(Date),
      },
    });

    expect(mocks.userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({
          status: "ACTIVE",
          emailVerifiedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("rejects an invalid or expired invitation", async () => {
    mocks.tokenFindFirst.mockResolvedValue(null);

    await expect(
      activateAccount(
        "invalid-token",
        "StrongPassword123!",
      ),
    ).rejects.toThrow(
      "Invalid or expired activation invitation",
    );

    expect(mocks.userCredentialCreate).not.toHaveBeenCalled();
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("rejects an account that is not pending", async () => {
    mocks.tokenFindFirst.mockResolvedValue({
      ...validInvitation,
      user: {
        id: "user-1",
        status: "ACTIVE",
      },
    });

    await expect(
      activateAccount(
        "valid-token",
        "StrongPassword123!",
      ),
    ).rejects.toThrow("This account cannot be activated");

    expect(mocks.userCredentialCreate).not.toHaveBeenCalled();
  });

  it("rejects an invitation that has already been consumed", async () => {
    mocks.tokenUpdateMany.mockResolvedValue({
      count: 0,
    });

    await expect(
      activateAccount(
        "already-used-token",
        "StrongPassword123!",
      ),
    ).rejects.toThrow(
      "This activation invitation has already been used",
    );

    expect(mocks.userCredentialCreate).not.toHaveBeenCalled();
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("stores the hash of the invitation token, not the raw token", async () => {
    const rawToken = "my-secret-activation-token";

    await activateAccount(
      rawToken,
      "StrongPassword123!",
    );

    expect(mocks.tokenFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tokenHash: hashActivationToken(rawToken),
        }),
      }),
    );

    expect(mocks.tokenFindFirst).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tokenHash: rawToken,
        }),
      }),
    );
  });

  it("rejects missing token or password", async () => {
    await expect(
      activateAccount("", "StrongPassword123!"),
    ).rejects.toThrow("Token and password are required");

    await expect(
      activateAccount("valid-token", ""),
    ).rejects.toThrow("Token and password are required");
  });
});
