
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  loadAccessContext: vi.fn(),
}));

vi.mock("../../src/config/db.js", () => ({
  default: {
    user: {
      findUnique: mocks.findUnique,
    },
  },
}));

vi.mock("../../src/modules/auth/accessService.js", () => ({
  loadAccessContext: mocks.loadAccessContext,
}));

import { getCurrentUser } from "../../src/modules/auth/currentUser.service.js";

describe("Get current user", () => {
  const user = {
    id: "user-123",
    email: "staff@example.com",
    phone: "+251911000000",
    firstName: "Abebe",
    middleName: "Kebede",
    lastName: "Example",
    status: "ACTIVE",
    emailVerifiedAt: new Date("2026-11-16T10:00:00.000Z"),
    lastLoginAt: new Date("2026-11-16T11:00:00.000Z"),
    assignments: [
      {
        id: "assignment-123",
        organization: {
          id: "org-123",
          code: "FGAE",
          name: "FGAE",
        },
        area: {
          id: "area-123",
          code: "AREA-01",
          name: "Addis Ababa",
        },
        branch: {
          id: "branch-123",
          code: "BR-01",
          name: "Bole Branch",
        },
      },
    ],
  };

  const accessContext = {
    role: "BRANCH_MANAGER",
    rolePermissions: ["USER_CREATE", "USER_READ"],
    areaIds: ["area-123"],
    branchIds: ["branch-123"],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.findUnique.mockResolvedValue(user);
    mocks.loadAccessContext.mockResolvedValue(accessContext);
  });

  it("returns the user profile, access context, and active assignments", async () => {
    const result = await getCurrentUser("user-123");

    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: "user-123" },
      select: expect.objectContaining({
        id: true,
        email: true,
        phone: true,
        assignments: expect.any(Object),
      }),
    });

    expect(mocks.loadAccessContext).toHaveBeenCalledWith("user-123");

    expect(result.id).toBe("user-123");
    expect(result.email).toBe("staff@example.com");

    expect(result.access).toEqual({
      role: "BRANCH_MANAGER",
      permissions: ["USER_CREATE", "USER_READ"],
      areaIds: ["area-123"],
      branchIds: ["branch-123"],
    });

    expect(result.assignments).toEqual(user.assignments);
    expect(result).not.toHaveProperty("passwordHash");
    expect(result).not.toHaveProperty("credential");
    expect(result).not.toHaveProperty("sessions");
  });

  it("rejects when the user does not exist", async () => {
    mocks.findUnique.mockResolvedValue(null);

    await expect(getCurrentUser("missing-user"))
      .rejects.toMatchObject({
        statusCode: 404,
        message: "User not found",
      });

    expect(mocks.loadAccessContext).not.toHaveBeenCalled();
  });

  it("rejects inactive users", async () => {
    mocks.findUnique.mockResolvedValue({
      ...user,
      status: "PENDING",
    });

    await expect(getCurrentUser("user-123"))
      .rejects.toMatchObject({
        statusCode: 403,
        message: "Account is not active",
      });

    expect(mocks.loadAccessContext).not.toHaveBeenCalled();
  });

  it("rejects users without a valid active access context", async () => {
    mocks.loadAccessContext.mockResolvedValue(null);

    await expect(getCurrentUser("user-123"))
      .rejects.toMatchObject({
        statusCode: 403,
        message: "User access is unavailable",
      });
  });

  it("forwards database errors", async () => {
    mocks.findUnique.mockRejectedValue(
      new Error("Database unavailable"),
    );

    await expect(getCurrentUser("user-123"))
      .rejects.toThrow("Database unavailable");
  });
});
