import { Prisma, type BuiltInRole } from "@prisma/client";
import prisma from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";

type RoleScope = {
  organizationId: string;
  areaId?: string;
  branchId?: string;
};

type RequestMetadata = {
  ipAddress?: string;
  userAgent?: string;
};

type AssignRoleInput = {
  actorId: string;
  targetUserId: string;
  roleCode: BuiltInRole;
  scope: RoleScope;
  reason?: string;
  metadata?: RequestMetadata;
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

export const assignUserRole = async (input: AssignRoleInput) => {
  const {
    actorId,
    targetUserId,
    roleCode,
    scope,
    reason,
    metadata,
  } = input;

  return prisma.$transaction(
    async (tx) => {
      // 1. Load the actor's trusted role and organizational scope.
      const actor = await tx.user.findUnique({
        where: { id: actorId },
        select: {
          status: true,
          roleAssignments: {
            where: { revokedAt: null },
            select: { role: { select: { code: true } } },
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
        throw new AppError("Actor must have exactly one active role", 403);
      }

      const activeRoleAssignment = actor.roleAssignments[0];

if (!activeRoleAssignment) {
  throw new Error("Actor has no active role assignment");
}

const actorRole = activeRoleAssignment.role.code;

      if (!DELEGATION[actorRole]?.includes(roleCode)) {
        throw new AppError("You cannot assign this role", 403);
      }

      // 2. Resolve and validate the requested organizational scope.
      let areaId: string | null = null;
      let branchId: string | null = null;

      if (roleCode === "SUPER_ADMIN") {
        if (scope.areaId || scope.branchId) {
          throw new AppError("Super Admin must have organization-wide scope", 400);
        }
      } else if (AREA_ROLES.has(roleCode)) {
        if (!scope.areaId || scope.branchId) {
          throw new AppError("This role requires an area scope", 400);
        }

        const area = await tx.area.findUnique({
          where: { id: scope.areaId },
          select: { organizationId: true },
        });

        if (!area || area.organizationId !== scope.organizationId) {
          throw new AppError("Invalid area or organization", 400);
        }

        areaId = scope.areaId;
      } else if (BRANCH_ROLES.has(roleCode)) {
        if (!scope.branchId) {
          throw new AppError("This role requires a branch scope", 400);
        }

        const branch = await tx.branch.findUnique({
          where: { id: scope.branchId },
          select: {
            areaId: true,
            area: { select: { organizationId: true } },
          },
        });

        if (!branch || branch.area.organizationId !== scope.organizationId) {
          throw new AppError("Invalid branch or organization", 400);
        }

        if (scope.areaId && scope.areaId !== branch.areaId) {
          throw new AppError("The branch does not belong to the supplied area", 400);
        }

        areaId = branch.areaId;
        branchId = scope.branchId;
      } else {
        throw new AppError("Unsupported role", 400);
      }

      // 3. Enforce the actor's own organizational boundaries.
      if (actorRole === "AREA_MANAGER") {
        const actorAreaIds = actor.assignments
          .filter((item) => item.organizationId === scope.organizationId)
          .map((item) => item.areaId)
          .filter((id): id is string => id !== null);

        if (!areaId || !actorAreaIds.includes(areaId)) {
          throw new AppError("You can only assign staff within your area", 403);
        }
      }

      if (actorRole === "BRANCH_MANAGER" ||
          actorRole === "VOLUNTEER_MANAGER") {
        const actorBranchIds = actor.assignments
          .filter((item) => item.organizationId === scope.organizationId)
          .map((item) => item.branchId)
          .filter((id): id is string => id !== null);

        if (!branchId || !actorBranchIds.includes(branchId)) {
          throw new AppError("You can only assign staff within your branch", 403);
        }
      }

      // 4. Confirm the target user exists and is eligible for assignment.
      const target = await tx.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, status: true },
      });

      if (!target) {
        throw new AppError("Target user not found", 404);
      }

      if (target.status === "INACTIVE" || target.status === "SUSPENDED") {
        throw new AppError("Cannot assign a role to an inactive or suspended user", 400);
      }

      const role = await tx.role.findUnique({
        where: { code: roleCode },
        select: { id: true },
      });

      if (!role) {
        throw new AppError("Role is not configured in the database", 500);
      }

      // 5. Enforce one active Project Manager per area.
      if (roleCode === "PROJECT_MANAGER" && areaId) {
        const existingManagers = await tx.userRole.findMany({
          where: {
            revokedAt: null,
            role: { code: "PROJECT_MANAGER" },
            userId: { not: targetUserId },
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

        const areaAlreadyHasManager = existingManagers.some((assignment) =>
          assignment.user.assignments.some(
            (item) => item.areaId === areaId,
          ),
        );

        if (areaAlreadyHasManager) {
          throw new AppError(
            "This area already has an active Project Manager",
            409,
          );
        }
      }

      // 6. Revoke the target user's previous active role and scope.
      await tx.userRole.updateMany({
        where: { userId: targetUserId, revokedAt: null },
        data: {
          revokedAt: new Date(),
          reason: reason ?? "Role changed",
        },
      });

      await tx.organizationalAssignment.updateMany({
        where: { userId: targetUserId, revokedAt: null },
        data: {
          revokedAt: new Date(),
          reason: reason ?? "Organizational assignment changed",
        },
      });

      // 7. Create the new role and organizational assignment.
      const newRoleAssignment = await tx.userRole.create({
        data: {
          userId: targetUserId,
          roleId: role.id,
          assignedById: actorId,
        },
      });

      await tx.organizationalAssignment.create({
        data: {
          userId: targetUserId,
          organizationId: scope.organizationId,
          areaId,
          branchId,
          assignedById: actorId,
        },
      });

      // 8. Record the change for accountability.
      await tx.auditLog.create({
        data: {
          actorId,
          targetUserId,
          action: "USER_ROLE_ASSIGNED",
          entityType: "USER_ROLE",
          entityId: newRoleAssignment.id,
          metadata: {
            roleCode,
            organizationId: scope.organizationId,
            areaId,
            branchId,
            reason: reason ?? null,
          },
          ipAddress: metadata?.ipAddress ?? null,
          userAgent: metadata?.userAgent ?? null,
        },
      });

      return {
        userId: targetUserId,
        role: roleCode,
        organizationId: scope.organizationId,
        areaId,
        branchId,
        assignedAt: newRoleAssignment.assignedAt,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
};