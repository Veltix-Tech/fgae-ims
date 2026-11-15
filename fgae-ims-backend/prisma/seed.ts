
import { PrismaClient } from "@prisma/client";
import {
  PERMISSION_CATALOG,
} from "../src/modules/auth/permissions.js";
import {
  ROLES,
  DEFAULT_ROLE_PERMISSIONS,
  type BuiltInRole,
} from "../src/modules/auth/rolePermissions.js";

const prisma = new PrismaClient();

const roleDescriptions: Record<BuiltInRole, string> = {
  SUPER_ADMIN: "Full system administration and operational access.",
  AREA_MANAGER: "Manages an assigned area and its branches.",
  PROJECT_MANAGER: "Creates and manages projects within an assigned area.",
  BRANCH_MANAGER: "Manages operations within an assigned branch.",
  VOLUNTEER_MANAGER: "Registers and manages volunteer records.",
  FIELD_SUPERVISOR: "Supervises volunteers, tasks, and allowance requests.",
  HR_OFFICER: "Read-only access to HR and authorized financial information.",
  FINANCE_OFFICER: "Manages budgets, transactions, and approved payments.",
  VOLUNTEER: "Access to personal volunteer tasks and allowance requests.",
};

async function main() {
  console.log("Starting FGAE-IMS permission seeding...");

  // Create or update the permission catalog from backend code.
  const permissionIds = new Map<string, string>();

  for (const permission of PERMISSION_CATALOG) {
    const saved = await prisma.permission.upsert({
      where: { key: permission.key },
      update: {
        module: permission.module,
        label: permission.label,
        description: permission.description,
      },
      create: {
        key: permission.key,
        module: permission.module,
        label: permission.label,
        description: permission.description,
      },
    });

    permissionIds.set(permission.key, saved.id);
  }

  // Create or update exactly the nine predefined roles.
  for (const roleCode of Object.values(ROLES) as BuiltInRole[]) {
    const role = await prisma.role.upsert({
      where: { code: roleCode },
      update: {
        name: roleCode.replaceAll("_", " "),
        description: roleDescriptions[roleCode],
      },
      create: {
        code: roleCode,
        name: roleCode.replaceAll("_", " "),
        description: roleDescriptions[roleCode],
      },
    });

    // Synchronize this role's permissions with the code definitions.
    const expectedPermissionIds = DEFAULT_ROLE_PERMISSIONS[roleCode].map(
      (permissionKey) => {
        const id = permissionIds.get(permissionKey);

        if (!id) {
          throw new Error(
            `Permission "${permissionKey}" is missing from PERMISSION_CATALOG.`,
          );
        }

        return id;
      },
    );

    await prisma.$transaction([
      prisma.rolePermission.deleteMany({
        where: {
          roleId: role.id,
          permissionId: {
            notIn: expectedPermissionIds,
          },
        },
      }),

      prisma.rolePermission.createMany({
        data: expectedPermissionIds.map((permissionId) => ({
          roleId: role.id,
          permissionId,
        })),
        skipDuplicates: true,
      }),
    ]);

    console.log(`Seeded role: ${roleCode}`);
  }

  console.log(
    `Successfully seeded ${Object.keys(ROLES).length} roles and ${PERMISSION_CATALOG.length} permissions.`,
  );
}

main()
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
