
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  createAccountActivationInvitation: vi.fn(),
  sendAccountActivationEmail: vi.fn(),
}));

vi.mock("../../src/config/db.js", () => ({
  default: {
    user: {
      findUnique: mocks.findUnique,
    },
  },
}));

vi.mock("../../src/modules/auth/activation.service.js", () => ({
  createAccountActivationInvitation:
    mocks.createAccountActivationInvitation,
}));

vi.mock("../../src/modules/auth/email.service.js", () => ({
  sendAccountActivationEmail: mocks.sendAccountActivationEmail,
}));

import {
  resendActivationInvitation,
} from "../../src/modules/auth/resendActivation.service.js";

describe("Resend activation invitation", () => {
  const invitation = {
    userId: "user-123",
    email: "staff@example.com",
    token: "new-activation-token",
    expiresAt: new Date("2026-11-17T10:00:00.000Z"),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.findUnique.mockResolvedValue({
      id: "user-123",
      status: "PENDING",
    });

    mocks.createAccountActivationInvitation.mockResolvedValue(
      invitation,
    );

    mocks.sendAccountActivationEmail.mockResolvedValue({
      sent: true,
    });
  });

  it("creates and sends a new invitation for a pending account", async () => {
    await resendActivationInvitation("staff@example.com");

    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { email: "staff@example.com" },
      select: { id: true, status: true },
    });

    expect(
      mocks.createAccountActivationInvitation,
    ).toHaveBeenCalledWith("user-123");

    expect(mocks.sendAccountActivationEmail).toHaveBeenCalledWith({
      email: invitation.email,
      token: invitation.token,
      expiresAt: invitation.expiresAt,
    });
  });

  it("normalizes the email address", async () => {
    await resendActivationInvitation("  STAFF@EXAMPLE.COM  ");

    expect(mocks.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "staff@example.com" },
      }),
    );
  });

  it("does nothing when the account does not exist", async () => {
    mocks.findUnique.mockResolvedValue(null);

    await resendActivationInvitation("unknown@example.com");

    expect(
      mocks.createAccountActivationInvitation,
    ).not.toHaveBeenCalled();

    expect(mocks.sendAccountActivationEmail).not.toHaveBeenCalled();
  });

  it("does nothing when the account is already active", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "user-123",
      status: "ACTIVE",
    });

    await resendActivationInvitation("staff@example.com");

    expect(
      mocks.createAccountActivationInvitation,
    ).not.toHaveBeenCalled();

    expect(mocks.sendAccountActivationEmail).not.toHaveBeenCalled();
  });

  it("does not throw when email delivery fails", async () => {
    mocks.sendAccountActivationEmail.mockRejectedValue(
      new Error("SMTP unavailable"),
    );

    await expect(
      resendActivationInvitation("staff@example.com"),
    ).resolves.toBeUndefined();

    expect(
      mocks.createAccountActivationInvitation,
    ).toHaveBeenCalledWith("user-123");
  });

  it("forwards database errors", async () => {
    mocks.findUnique.mockRejectedValue(
      new Error("Database unavailable"),
    );

    await expect(
      resendActivationInvitation("staff@example.com"),
    ).rejects.toThrow("Database unavailable");
  });
});
