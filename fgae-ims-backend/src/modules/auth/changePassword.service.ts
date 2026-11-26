
import prisma from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import {
  hashPassword,
  verifyPassword,
} from "../../utils/password.js";

export const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string,
) => {
  if (!userId || !currentPassword || !newPassword) {
    throw new AppError("All password fields are required", 400);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      status: true,
      credential: {
        select: {
          passwordHash: true,
        },
      },
    },
  });

  if (!user || user.status !== "ACTIVE" || !user.credential) {
    throw new AppError("Account is not eligible to change password", 401);
  }

  const isCurrentPasswordValid = await verifyPassword(
    user.credential.passwordHash,
    currentPassword,
  );

  if (!isCurrentPasswordValid) {
    throw new AppError("Current password is incorrect", 401);
  }

  const isSamePassword = await verifyPassword(
    user.credential.passwordHash,
    newPassword,
  );

  if (isSamePassword) {
    throw new AppError(
      "New password must be different from the current password",
      400,
    );
  }

  const newPasswordHash = await hashPassword(newPassword);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.userCredential.update({
      where: { userId },
      data: {
        passwordHash: newPasswordHash,
        passwordChangedAt: now,
      },
    });

    // Require the user to log in again on all devices.
    await tx.userSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });
  });

  return {
    message: "Password changed successfully. Please log in again.",
  };
};
