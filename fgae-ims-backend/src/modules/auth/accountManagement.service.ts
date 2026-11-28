
import { Prisma, type BuiltInRole } from "@prisma/client";
import prisma from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";

type CreateStaffInput = {
  actorId: string;
  email: string;
  phone?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  roleCode: BuiltInRole;
  organizationId: string;
  areaId?: string;
  branchId?: string;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
  };
};

const AREA_ROLES = new Set<string>([
  "AREA_MANAGER",
  "PROJECT_MANAGER",
  "HR_OFFICER",
  "FINANCE_OFFICER",
]);

const BRANCH_ROLES = new Set<string>([
  "BRANCH_MANAGER",
  "VOLUNTEER_MANAGER",
  "FIELD_SUPERVISOR",
  "VOLUNTEER",
]);

const DELEGATION: Record<string, string[]> = {
  SUPER_ADMIN: [
    "SUPER_ADMIN",
    "AREA_MANAGER",
    "PROJECT_MANAGER",
    "BRANCH_MANAGER",
    "VOLUNTEER_MANAGER",
    "FIELD_SUPERVISOR",
    "HR_OFFICER",
    "FINANCE_OFFICER",
    "VOLUNTEER",
  ],
  AREA_MANAGER: [
    "PROJECT_MANAGER",
    "BRANCH_MANAGER",
    "VOLUNTEER_MANAGER",
    "FIELD_SUPERVISOR",
    "HR_OFFICER",
    "FINANCE_OFFICER",
  ],
  BRANCH_MANAGER: [
    "VOLUNTEER_MANAGER",
    "FIELD_SUPERVISOR",
  ],
  VOLUNTEER_MANAGER: ["VOLUNTEER"],
};

export const createStaffAccount = async (
  input: CreateStaffInput,
) => {
  const email = input.email.trim().toLowerCase();
  const phone = input.phone?.trim() || null;

  const firstName = input.firstName.trim();
  const middleName = input.middleName?.trim() || null;
  const lastName = input.lastName.trim();

  if (!email || !firstName || !lastName) {
    throw new AppError(
      "Email, first name, and last name are required",
      400,
    );
  }

  return prisma.$transaction(
    async (tx) => {
      // 1. Load trusted actor information.
      const actor = await tx.user.findUnique({
        where: { id: input.actorId },
        select: {
          status: true,
          roleAssignments: {
            where: { revokedAt: null },
            select: {
              role: { select: { code: true } },
            },
          },
          assignments: {
            where: { revokedAt: null },
            select: {
              organizationId: true,
              areaId: true,
              branchId: true,
            },
          },
        },
      });

      if (!actor || actor.status !== "ACTIVE") {
        throw new AppError("Active actor account required", 403);
      }

      if (actor.roleAssignments.length !== 1) {
        throw new AppError(
          "Actor must have exactly one active role",
          403,
        );
      }

      const actorRole = actor.roleAssignments[0]?.role.code;

      if (
        !actorRole ||
        !DELEGATION[actorRole]?.includes(input.roleCode)
      ) {
        throw new AppError("You cannot create this account", 403);
      }

      // 2. Validate organization.
      const organization = await tx.organization.findUnique({
        where: { id: input.organizationId },
        select: { id: true },
      });

      if (!organization) {
        throw new AppError("Organization not found", 404);
      }

      // 3. Validate the requested role scope.
      let areaId: string | null = null;
      let branchId: string | null = null;

      if (input.roleCode === "SUPER_ADMIN") {
        if (input.areaId || input.branchId) {
          throw new AppError(
            "Super Admin must have organization-wide scope",
            400,
          );
        }
      } else if (AREA_ROLES.has(input.roleCode)) {
        if (!input.areaId || input.branchId) {
          throw new AppError(
            "This role requires an area scope",
            400,
          );
        }

        const area = await tx.area.findUnique({
          where: { id: input.areaId },
          select: { organizationId: true },
        });

        if (
          !area ||
          area.organizationId !== input.organizationId
        ) {
          throw new AppError(
            "Invalid area or organization",
            400,
          );
        }

        areaId = input.areaId;
      } else if (BRANCH_ROLES.has(input.roleCode)) {
        if (!input.branchId) {
          throw new AppError(
            "This role requires a branch scope",
            400,
          );
        }

        const branch = await tx.branch.findUnique({
          where: { id: input.branchId },
          select: {
            areaId: true,
            area: { select: { organizationId: true } },
          },
        });

        if (
          !branch ||
          branch.area.organizationId !== input.organizationId
        ) {
          throw new AppError(
            "Invalid branch or organization",
            400,
          );
        }

        if (
          input.areaId &&
          input.areaId !== branch.areaId
        ) {
          throw new AppError(
            "Branch does not belong to the supplied area",
            400,
          );
        }

        areaId = branch.areaId;
        branchId = input.branchId;
      } else {
        throw new AppError("Unsupported role", 400);
      }

      // 4. Enforce the actor's organizational boundaries.
      if (actorRole === "AREA_MANAGER") {
        const actorAreaIds = actor.assignments
          .filter(
            (assignment) =>
              assignment.organizationId === input.organizationId,
          )
          .map((assignment) => assignment.areaId)
          .filter((id): id is string => id !== null);

        if (!areaId || !actorAreaIds.includes(areaId)) {
          throw new AppError(
            "You can only create accounts within your area",
            403,
          );
        }
      }

      if (
        actorRole === "BRANCH_MANAGER" ||
        actorRole === "VOLUNTEER_MANAGER"
      ) {
        const actorBranchIds = actor.assignments
          .filter(
            (assignment) =>
              assignment.organizationId === input.organizationId,
          )
          .map((assignment) => assignment.branchId)
          .filter((id): id is string => id !== null);

        if (!branchId || !actorBranchIds.includes(branchId)) {
          throw new AppError(
            "You can only create accounts within your branch",
            403,
          );
        }
      }

      // 5. Prevent duplicate accounts.
      const existingUser = await tx.user.findFirst({
        where: {
          OR: [
            { email },
            ...(phone ? [{ phone }] : []),
          ],
        },
        select: { id: true },
      });

      if (existingUser) {
        throw new AppError(
          "An account with this email or phone already exists",
          409,
        );
      }

      // 6. Confirm the predefined role exists.
      const role = await tx.role.findUnique({
        where: { code: input.roleCode },
        select: { id: true },
      });

      if (!role) {
        throw new AppError(
          "Role is not configured in the database",
          500,
        );
      }

      // 7. Enforce one Project Manager per area.
      if (input.roleCode === "PROJECT_MANAGER" && areaId) {
        const existingManagers = await tx.userRole.findMany({
          where: {
            revokedAt: null,
            role: { code: "PROJECT_MANAGER" },
          },
          select: {
            user: {
              select: {
                assignments: {
                  where: { revokedAt: null },
                  select: { areaId: true },
                },
              },
            },
          },
        });

        const areaAlreadyHasManager = existingManagers.some(
          (manager) =>
            manager.user.assignments.some(
              (assignment) => assignment.areaId === areaId,
            ),
        );

        if (areaAlreadyHasManager) {
          throw new AppError(
            "This area already has an active Project Manager",
            409,
          );
        }
      }

      // 8. Create the pending account.
      const user = await tx.user.create({
        data: {
          email,
          phone,
          firstName,
          middleName,
          lastName,
          status: "PENDING",
        },
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          middleName: true,
          lastName: true,
          status: true,
          createdAt: true,
        },
      });

      // 9. Assign role and organizational scope.
      const roleAssignment = await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: role.id,
          assignedById: input.actorId,
        },
      });

      await tx.organizationalAssignment.create({
        data: {
          userId: user.id,
          organizationId: input.organizationId,
          areaId,
          branchId,
          assignedById: input.actorId,
        },
      });

      // 10. Record account creation.
      await tx.auditLog.create({
        data: {
          actorId: input.actorId,
          targetUserId: user.id,
          action: "STAFF_ACCOUNT_CREATED",
          entityType: "USER",
          entityId: user.id,
          metadata: {
            roleCode: input.roleCode,
            organizationId: input.organizationId,
            areaId,
            branchId,
          },
          ipAddress: input.metadata?.ipAddress ?? null,
          userAgent: input.metadata?.userAgent ?? null,
        },
      });

      return {
        user,
        role: input.roleCode,
        organizationId: input.organizationId,
        areaId,
        branchId,
        roleAssignmentId: roleAssignment.id,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
};
