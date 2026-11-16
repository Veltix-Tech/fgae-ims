
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createStaffAccount: vi.fn(),
  createAccountActivationInvitation: vi.fn(),
  sendAccountActivationEmail: vi.fn(),
}));

vi.mock("../../src/modules/auth/accountManagement.service.js", () => ({
  createStaffAccount: mocks.createStaffAccount,
}));

vi.mock("../../src/modules/auth/activation.service.js", () => ({
  createAccountActivationInvitation:
    mocks.createAccountActivationInvitation,
}));

vi.mock("../../src/modules/auth/email.service.js", () => ({
  sendAccountActivationEmail: mocks.sendAccountActivationEmail,
}));

import {
  createStaffAccountWithInvitation,
} from "../../src/modules/auth/staffInvitation.service.js";

describe("Staff invitation workflow", () => {
  const account = {
    user: {
      id: "user-123",
      email: "staff@example.com",
      status: "PENDING",
    },
    role: "BRANCH_MANAGER",
    organizationId: "org-123",
    areaId: "area-123",
    branchId: "branch-123",
    roleAssignmentId: "role-assignment-123",
  };

  const invitation = {
    userId: "user-123",
    email: "staff@example.com",
    token: "activation-token",
    expiresAt: new Date("2026-11-17T10:00:00.000Z"),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.createStaffAccount.mockResolvedValue(account);
    mocks.createAccountActivationInvitation.mockResolvedValue(
      invitation,
    );
    mocks.sendAccountActivationEmail.mockResolvedValue({
      sent: true,
    });
  });

  it("creates an account and sends its activation invitation", async () => {
    const result = await createStaffAccountWithInvitation({
      actorId: "actor-123",
      email: "staff@example.com",
      firstName: "Test",
      lastName: "Staff",
      roleCode: "BRANCH_MANAGER",
      organizationId: "org-123",
      branchId: "branch-123",
    });

    expect(mocks.createStaffAccount).toHaveBeenCalledOnce();

    expect(
      mocks.createAccountActivationInvitation,
    ).toHaveBeenCalledWith("user-123");

    expect(mocks.sendAccountActivationEmail).toHaveBeenCalledWith({
      email: invitation.email,
      token: invitation.token,
      expiresAt: invitation.expiresAt,
    });

    expect(result.invitationSent).toBe(true);
    expect(result.user.id).toBe("user-123");
  });

  it("keeps the created account when email delivery fails", async () => {
    mocks.sendAccountActivationEmail.mockRejectedValue(
      new Error("SMTP unavailable"),
    );

    const result = await createStaffAccountWithInvitation({
      actorId: "actor-123",
      email: "staff@example.com",
      firstName: "Test",
      lastName: "Staff",
      roleCode: "BRANCH_MANAGER",
      organizationId: "org-123",
      branchId: "branch-123",
    });

    expect(result.user.id).toBe("user-123");
    expect(result.invitationSent).toBe(false);
  });

  it("does not create an invitation when account creation fails", async () => {
    mocks.createStaffAccount.mockRejectedValue(
      new Error("Account creation failed"),
    );

    await expect(
      createStaffAccountWithInvitation({
        actorId: "actor-123",
        email: "staff@example.com",
        firstName: "Test",
        lastName: "Staff",
        roleCode: "BRANCH_MANAGER",
        organizationId: "org-123",
        branchId: "branch-123",
      }),
    ).rejects.toThrow("Account creation failed");

    expect(
      mocks.createAccountActivationInvitation,
    ).not.toHaveBeenCalled();

    expect(mocks.sendAccountActivationEmail).not.toHaveBeenCalled();
  });

  it("propagates invitation creation failures", async () => {
    mocks.createAccountActivationInvitation.mockRejectedValue(
      new Error("Invitation creation failed"),
    );

    await expect(
      createStaffAccountWithInvitation({
        actorId: "actor-123",
        email: "staff@example.com",
        firstName: "Test",
        lastName: "Staff",
        roleCode: "BRANCH_MANAGER",
        organizationId: "org-123",
        branchId: "branch-123",
      }),
    ).rejects.toThrow("Invitation creation failed");

    expect(mocks.sendAccountActivationEmail).not.toHaveBeenCalled();
  });
});
