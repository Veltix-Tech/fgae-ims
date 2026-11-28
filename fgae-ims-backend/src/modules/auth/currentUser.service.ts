
import prisma from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { loadAccessContext } from "./accessService.js";

export const getCurrentUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      phone: true,
      firstName: true,
      middleName: true,
      lastName: true,
      status: true,
      emailVerifiedAt: true,
      lastLoginAt: true,
      assignments: {
        where: { revokedAt: null },
        select: {
          id: true,
          organization: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          area: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          branch: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (user.status !== "ACTIVE") {
    throw new AppError("Account is not active", 403);
  }

  const accessContext = await loadAccessContext(userId);

  if (!accessContext) {
    throw new AppError("User access is unavailable", 403);
  }

  return {
    ...user,
    access: {
      role: accessContext.role,
      permissions: accessContext.rolePermissions,
      areaIds: accessContext.areaIds,
      branchIds: accessContext.branchIds,
    },
  };
};
