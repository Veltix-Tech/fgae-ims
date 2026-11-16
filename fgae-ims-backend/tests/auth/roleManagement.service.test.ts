
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  userFindUnique: vi.fn(),
  areaFindUnique: vi.fn(),
  branchFindUnique: vi.fn(),
  roleFindUnique: vi.fn(),
  userRoleFindMany: vi.fn(),
  userRoleUpdateMany: vi.fn(),
  userRoleCreate: vi.fn(),
  assignmentUpdateMany: vi.fn(),
  assignmentCreate: vi.fn(),
  auditLogCreate: vi.fn(),
}));

vi.mock("../../src/config/db.js", () => ({
  default: {
    $transaction: mocks.transaction,
  },
}));

import { assignUserRole } from "../../src/modules/auth/roleManagement.service.js";

const tx = {
  user: { findUnique: mocks.userFindUnique },
  area: { findUnique: mocks.areaFindUnique },
  branch: { findUnique: mocks.branchFindUnique },
  role: { findUnique: mocks.roleFindUnique },
  userRole: {
    findMany: mocks.userRoleFindMany,
    updateMany: mocks.userRoleUpdateMany,
    create: mocks.userRoleCreate,
  },
  organizationalAssignment: {
    updateMany: mocks.assignmentUpdateMany,
    create: mocks.assignmentCreate,
  },
  auditLog: { create: mocks.auditLogCreate },
};

const organizationId = "org-1";
const areaId = "area-1";
const branchId = "branch-1";

const areaManager = {
  status: "ACTIVE",
  roleAssignments: [
    { role: { code: "AREA_MANAGER" } },
  ],
  assignments: [
    {
      organizationId,
      areaId,
      branchId: null,
    },
  ],
};

const branchManager = {
  status: "ACTIVE",
  roleAssignments: [
    { role: { code: "BRANCH_MANAGER" } },
  ],
  assignments: [
    {
      organizationId,
      areaId,
      branchId,
    },
  ],
};

const superAdmin = {
  status: "ACTIVE",
  roleAssignments: [
    { role: { code: "SUPER_ADMIN" } },
  ],
  assignments: [],
};

const targetUser = {
  id: "target-1",
  status: "PENDING",
};

const setupSuccessfulAssignment = (actor: object) => {
  mocks.userFindUnique
    .mockResolvedValueOnce(actor)
    .mockResolvedValueOnce(targetUser);

  mocks.branchFindUnique.mockResolvedValue({
    areaId,
    area: { organizationId },
  });

  mocks.areaFindUnique.mockResolvedValue({
    organizationId,
  });

  mocks.roleFindUnique.mockResolvedValue({
    id: "role-1",
  });

  mocks.userRoleFindMany.mockResolvedValue([]);

  mocks.userRoleCreate.mockResolvedValue({
    id: "role-assignment-1",
    assignedAt: new Date("2026-11-15T12:00:00Z"),
  });
};

describe("Role management service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.transaction.mockImplementation(
      async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
    );

    mocks.userRoleUpdateMany.mockResolvedValue({ count: 1 });
    mocks.assignmentUpdateMany.mockResolvedValue({ count: 1 });
    mocks.assignmentCreate.mockResolvedValue({});
    mocks.auditLogCreate.mockResolvedValue({});
  });

  it("allows an Area Manager to assign branch-level staff within their area", async () => {
    setupSuccessfulAssignment(areaManager);

    const result = await assignUserRole({
      actorId: "area-manager-1",
      targetUserId: "target-1",
      roleCode: "VOLUNTEER_MANAGER",
      scope: {
        organizationId,
        branchId,
      },
    });

    expect(result.role).toBe("VOLUNTEER_MANAGER");
    expect(result.areaId).toBe(areaId);
    expect(result.branchId).toBe(branchId);

    expect(mocks.userRoleCreate).toHaveBeenCalled();
    expect(mocks.assignmentCreate).toHaveBeenCalled();
    expect(mocks.auditLogCreate).toHaveBeenCalled();
  });

  it("denies a Branch Manager from assigning a role outside their branch", async () => {
    mocks.userFindUnique.mockResolvedValueOnce(branchManager);

    mocks.branchFindUnique.mockResolvedValue({
      areaId,
      area: { organizationId },
    });

    await expect(
      assignUserRole({
        actorId: "branch-manager-1",
        targetUserId: "target-1",
        roleCode: "VOLUNTEER_MANAGER",
        scope: {
          organizationId,
          branchId: "another-branch",
        },
      }),
    ).rejects.toThrow(
      "You can only assign staff within your branch",
    );

    expect(mocks.userRoleCreate).not.toHaveBeenCalled();
  });

  it("denies a Branch Manager from assigning an unauthorized role", async () => {
    mocks.userFindUnique.mockResolvedValueOnce(branchManager);

    await expect(
      assignUserRole({
        actorId: "branch-manager-1",
        targetUserId: "target-1",
        roleCode: "FINANCE_OFFICER",
        scope: {
          organizationId,
          areaId,
        },
      }),
    ).rejects.toThrow("You cannot assign this role");

    expect(mocks.userRoleCreate).not.toHaveBeenCalled();
  });

  it("denies an Area Manager from assigning staff outside their area", async () => {
    mocks.userFindUnique.mockResolvedValueOnce(areaManager);

    mocks.branchFindUnique.mockResolvedValue({
      areaId: "area-2",
      area: { organizationId },
    });

    await expect(
      assignUserRole({
        actorId: "area-manager-1",
        targetUserId: "target-1",
        roleCode: "VOLUNTEER_MANAGER",
        scope: {
          organizationId,
          branchId: "branch-outside-area",
        },
      }),
    ).rejects.toThrow(
      "You can only assign staff within your area",
    );

    expect(mocks.userRoleCreate).not.toHaveBeenCalled();
  });

  it("prevents a second active Project Manager in the same area", async () => {
    setupSuccessfulAssignment(areaManager);

    mocks.userFindUnique
      .mockReset()
      .mockResolvedValueOnce(areaManager)
      .mockResolvedValueOnce(targetUser);

    mocks.areaFindUnique.mockResolvedValue({ organizationId });

    mocks.userRoleFindMany.mockResolvedValue([
      {
        user: {
          assignments: [{ areaId }],
        },
      },
    ]);

    await expect(
      assignUserRole({
        actorId: "area-manager-1",
        targetUserId: "target-1",
        roleCode: "PROJECT_MANAGER",
        scope: {
          organizationId,
          areaId,
        },
      }),
    ).rejects.toThrow(
      "This area already has an active Project Manager",
    );

    expect(mocks.userRoleCreate).not.toHaveBeenCalled();
  });

  it("allows Super Admin to assign a role and records an audit log", async () => {
    setupSuccessfulAssignment(superAdmin);

    const result = await assignUserRole({
      actorId: "super-admin-1",
      targetUserId: "target-1",
      roleCode: "VOLUNTEER_MANAGER",
      scope: {
        organizationId,
        branchId,
      },
      reason: "New staff assignment",
      metadata: {
        ipAddress: "127.0.0.1",
        userAgent: "Vitest",
      },
    });

    expect(result.userId).toBe("target-1");

    expect(mocks.auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: "super-admin-1",
          targetUserId: "target-1",
          action: "USER_ROLE_ASSIGNED",
        }),
      }),
    );
  });
});
