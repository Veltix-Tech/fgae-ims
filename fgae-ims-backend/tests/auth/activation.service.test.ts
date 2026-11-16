
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  userFindUnique: vi.fn(),
  tokenUpdateMany: vi.fn(),
  tokenCreate: vi.fn(),
}));

vi.mock("../../src/config/db.js", () => ({
  default: {
    $transaction: mocks.transaction,
  },
}));

import { ActivationPurpose } from "@prisma/client";
import { createAccountActivationInvitation } from "../../src/modules/auth/activation.service.js";
import { hashActivationToken } from "../../src/utils/activationToken.js";

const tx = {
  user: {
    findUnique: mocks.userFindUnique,
  },
  accountActivationToken: {
    updateMany: mocks.tokenUpdateMany,
    create: mocks.tokenCreate,
  },
};

describe("createAccountActivationInvitation", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.transaction.mockImplementation(
      async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
    );

    mocks.userFindUnique.mockResolvedValue({
      id: "user-1",
      email: "staff@example.com",
      status: "PENDING",
    });

    mocks.tokenUpdateMany.mockResolvedValue({ count: 0 });
    mocks.tokenCreate.mockResolvedValue({ id: "token-1" });
  });

  it("creates an activation invitation for a pending user", async () => {
    const result = await createAccountActivationInvitation("user-1");

    expect(result.userId).toBe("user-1");
    expect(result.email).toBe("staff@example.com");
    expect(result.token).toMatch(/^[a-f0-9]{64}$/);

    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());

    expect(mocks.tokenCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        purpose: ActivationPurpose.ACCOUNT_ACTIVATION,
        tokenHash: hashActivationToken(result.token),
      }),
    });
  });

  it("rejects when the user does not exist", async () => {
    mocks.userFindUnique.mockResolvedValue(null);

    await expect(
      createAccountActivationInvitation("missing-user"),
    ).rejects.toThrow("User not found");

    expect(mocks.tokenCreate).not.toHaveBeenCalled();
  });

  it("rejects accounts that are not pending", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: "user-1",
      email: "staff@example.com",
      status: "ACTIVE",
    });

    await expect(
      createAccountActivationInvitation("user-1"),
    ).rejects.toThrow(
      "Only pending accounts can receive activation invitations",
    );

    expect(mocks.tokenCreate).not.toHaveBeenCalled();
  });

  it("invalidates previous unused activation invitations", async () => {
    await createAccountActivationInvitation("user-1");

    expect(mocks.tokenUpdateMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        purpose: ActivationPurpose.ACCOUNT_ACTIVATION,
        usedAt: null,
      },
      data: {
        usedAt: expect.any(Date),
      },
    });
  });
});
