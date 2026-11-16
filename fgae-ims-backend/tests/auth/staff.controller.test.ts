
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createStaffAccountWithInvitation: vi.fn(),
}));

vi.mock("../../src/modules/auth/staffInvitation.service.js", () => ({
  createStaffAccountWithInvitation:
    mocks.createStaffAccountWithInvitation,
}));

import { createStaff } from "../../src/modules/auth/auth.controller.js";

describe("Create staff controller", () => {
  const accountResult = {
    user: {
      id: "user-123",
      email: "staff@example.com",
      status: "PENDING",
    },
    role: "BRANCH_MANAGER",
    organizationId: "org-123",
    areaId: "area-123",
    branchId: "branch-123",
    roleAssignmentId: "assignment-123",
    invitationSent: true,
  };

  const createMocks = (userId?: string) => {
    const req = {
      auth: userId ? { userId } : undefined,
      body: {
        email: "staff@example.com",
        firstName: "Test",
        lastName: "Staff",
        roleCode: "BRANCH_MANAGER",
        organizationId: "org-123",
        branchId: "branch-123",
      },
      ip: "127.0.0.1",
      get: vi.fn().mockReturnValue("Vitest"),
    } as any;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as any;

    const next = vi.fn();

    return { req, res, next };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createStaffAccountWithInvitation.mockResolvedValue(
      accountResult,
    );
  });

  it("creates a staff account and returns 201", async () => {
    const { req, res, next } = createMocks("actor-123");

    await createStaff(req, res, next);

    expect(mocks.createStaffAccountWithInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "actor-123",
        email: "staff@example.com",
        roleCode: "BRANCH_MANAGER",
        metadata: {
          ipAddress: "127.0.0.1",
          userAgent: "Vitest",
        },
      }),
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
        data: expect.objectContaining({
          invitationSent: true,
        }),
      }),
    );

    expect(next).not.toHaveBeenCalled();
  });

  it("does not expose the activation token", async () => {
    const { req, res } = createMocks("actor-123");

    await createStaff(req, res, vi.fn());

    const response = res.json.mock.calls[0][0];

    expect(response.data).not.toHaveProperty("token");
    expect(response.data).not.toHaveProperty("activationToken");
  });

  it("returns a successful account creation response when email fails", async () => {
    mocks.createStaffAccountWithInvitation.mockResolvedValue({
      ...accountResult,
      invitationSent: false,
    });

    const { req, res } = createMocks("actor-123");

    await createStaff(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("could not be sent"),
        data: expect.objectContaining({
          invitationSent: false,
        }),
      }),
    );
  });

  it("rejects a request without an authenticated user", async () => {
    const { req, res, next } = createMocks();

    await createStaff(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mocks.createStaffAccountWithInvitation).not.toHaveBeenCalled();
  });

  it("passes service errors to the error handler", async () => {
    mocks.createStaffAccountWithInvitation.mockRejectedValue(
      new Error("You cannot create this account"),
    );

    const { req, res, next } = createMocks("actor-123");

    await createStaff(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "You cannot create this account",
      }),
    );

    expect(res.status).not.toHaveBeenCalled();
  });
});
