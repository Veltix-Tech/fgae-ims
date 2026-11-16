
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  userFindUnique: vi.fn(),
  organizationFindUnique: vi.fn(),
  areaFindUnique: vi.fn(),
  branchFindUnique: vi.fn(),
  userFindFirst: vi.fn(),
  roleFindUnique: vi.fn(),
  userRoleFindMany: vi.fn(),
  userCreate: vi.fn(),
  userRoleCreate: vi.fn(),
  assignmentCreate: vi.fn(),
  auditLogCreate: vi.fn(),
}));

vi.mock("../../src/config/db.js", () => ({
  default: {
    $transaction: mocks.transaction,
  },
}));

import { createStaffAccount } from "../../src/modules/auth/accountManagement.service.js";

const tx = {
  user: {
    findUnique: mocks.userFindUnique,
    findFirst: mocks.userFindFirst,
    create: mocks.userCreate,
  },
  organization: {
    findUnique: mocks.organizationFindUnique,
  },
  area: {
    findUnique: mocks.areaFindUnique,
  },
  branch: {
    findUnique: mocks.branchFindUnique,
  },
  role: {
    findUnique: mocks.roleFindUnique,
  },
  userRole: {
    findMany: mocks.userRoleFindMany,
    create: mocks.userRoleCreate,
  },
  organizationalAssignment: {
    create: mocks.assignmentCreate,
  },
  auditLog: {
    create: mocks.auditLogCreate,
  },
};

const superAdmin = {
  status: "ACTIVE",
  roleAssignments: [{ role: { code: "SUPER_ADMIN" } }],
  assignments: [],
};

const areaManager = {
  status: "ACTIVE",
  roleAssignments: [{ role: { code: "AREA_MANAGER" } }],
  assignments: [
    {
      organizationId: "org-1",
      areaId: "area-1",
      branchId: null,
    },
  ],
};

const branchManager = {
  status: "ACTIVE",
  roleAssignments: [{ role: { code: "BRANCH_MANAGER" } }],
  assignments: [
    {
      organizationId: "org-1",
      areaId: "area-1",
      branchId: "branch-1",
    },
  ],
};

const staffInput = {
  actorId: "actor-1",
  email: " Staff@Example.com ",
  phone: "0911000000",
  firstName: " Staff ",
  middleName: " Test ",
  lastName: " Member ",
  roleCode: "VOLUNTEER_MANAGER" as const,
  organizationId: "org-1",
  branchId: "branch-1",
};

describe("createStaffAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.transaction.mockImplementation(
      async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
    );

    mocks.organizationFindUnique.mockResolvedValue({
      id: "org-1",
    });

    mocks.areaFindUnique.mockResolvedValue({
      organizationId: "org-1",
    });

    mocks.branchFindUnique.mockResolvedValue({
      areaId: "area-1",
      area: {
        organizationId: "org-1",
      },
    });

    mocks.userFindFirst.mockResolvedValue(null);

    mocks.roleFindUnique.mockResolvedValue({
      id: "role-1",
    });

    mocks.userRoleFindMany.mockResolvedValue([]);

    mocks.userCreate.mockResolvedValue({
      id: "new-user-1",
      email: "staff@example.com",
      phone: "0911000000",
      firstName: "Staff",
      middleName: "Test",
      lastName: "Member",
      status: "PENDING",
      createdAt: new Date(),
    });

    mocks.userRoleCreate.mockResolvedValue({
      id: "new-role-assignment",
    });

    mocks.assignmentCreate.mockResolvedValue({});
    mocks.auditLogCreate.mockResolvedValue({});
  });

  it("allows Super Admin to create a pending staff account", async () => {
    mocks.userFindUnique.mockResolvedValue(superAdmin);

    const result = await createStaffAccount({
      ...staffInput,
      actorId: "admin-1",
    });

    expect(result.user.status).toBe("PENDING");
    expect(result.role).toBe("VOLUNTEER_MANAGER");

    expect(mocks.userCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "staff@example.com",
          firstName: "Staff",
          status: "PENDING",
        }),
      }),
    );
  });

  it("allows Area Manager to create branch-level staff within their area", async () => {
    mocks.userFindUnique.mockResolvedValue(areaManager);

    const result = await createStaffAccount({
      ...staffInput,
      actorId: "area-manager-1",
    });

    expect(result.areaId).toBe("area-1");
    expect(result.branchId).toBe("branch-1");
    expect(mocks.userCreate).toHaveBeenCalledOnce();
  });

  it("rejects Branch Manager creating an account outside their branch", async () => {
    mocks.userFindUnique.mockResolvedValue(branchManager);

    await expect(
      createStaffAccount({
        ...staffInput,
        actorId: "branch-manager-1",
        branchId: "branch-2",
      }),
    ).rejects.toThrow(
      "You can only create accounts within your branch",
    );

    expect(mocks.userCreate).not.toHaveBeenCalled();
  });

  it("rejects Branch Manager creating an unauthorized role", async () => {
    mocks.userFindUnique.mockResolvedValue(branchManager);

    await expect(
      createStaffAccount({
        ...staffInput,
        actorId: "branch-manager-1",
        roleCode: "FINANCE_OFFICER",
        areaId: "area-1",
        branchId: undefined,
      }),
    ).rejects.toThrow("You cannot create this account");

    expect(mocks.userCreate).not.toHaveBeenCalled();
  });

  it("rejects an existing email or phone number", async () => {
    mocks.userFindUnique.mockResolvedValue(superAdmin);
    mocks.userFindFirst.mockResolvedValue({
      id: "existing-user",
    });

    await expect(
      createStaffAccount({
        ...staffInput,
        actorId: "admin-1",
      }),
    ).rejects.toThrow(
      "An account with this email or phone already exists",
    );

    expect(mocks.userCreate).not.toHaveBeenCalled();
  });

  it("creates role assignment, organizational assignment, and audit log", async () => {
    mocks.userFindUnique.mockResolvedValue(superAdmin);

    await createStaffAccount({
      ...staffInput,
      actorId: "admin-1",
    });

    expect(mocks.userRoleCreate).toHaveBeenCalledWith({
      data: {
        userId: "new-user-1",
        roleId: "role-1",
        assignedById: "admin-1",
      },
    });

    expect(mocks.assignmentCreate).toHaveBeenCalledWith({
      data: {
        userId: "new-user-1",
        organizationId: "org-1",
        areaId: "area-1",
        branchId: "branch-1",
        assignedById: "admin-1",
      },
    });

    expect(mocks.auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: "admin-1",
          targetUserId: "new-user-1",
          action: "STAFF_ACCOUNT_CREATED",
          entityType: "USER",
        }),
      }),
    );
  });

  it("rejects a second Project Manager in the same area", async () => {
    mocks.userFindUnique.mockResolvedValue(areaManager);

    mocks.userRoleFindMany.mockResolvedValue([
      {
        user: {
          assignments: [{ areaId: "area-1" }],
        },
      },
    ]);

    await expect(
      createStaffAccount({
        actorId: "area-manager-1",
        email: "pm@example.com",
        firstName: "Project",
        lastName: "Manager",
        roleCode: "PROJECT_MANAGER",
        organizationId: "org-1",
        areaId: "area-1",
      }),
    ).rejects.toThrow(
      "This area already has an active Project Manager",
    );

    expect(mocks.userCreate).not.toHaveBeenCalled();
  });
});
