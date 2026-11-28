
import { ActivationPurpose, Prisma } from "@prisma/client";
import prisma from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { hashPassword } from "../../utils/password.js";
import {
  generateActivationToken,
  hashActivationToken,
} from "../../utils/activationToken.js";

const PASSWORD_RESET_EXPIRY_MINUTES = 30;

export const createPasswordResetRequest = async (email: string) => {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      status: true,
      credential: {
        select: { id: true },
      },
    },
  });

  // Do not disclose whether an account exists or is eligible.
  if (!user || user.status !== "ACTIVE" || !user.credential) {
    return null;
  }

  const now = new Date();
  const rawToken = generateActivationToken();
  const tokenHash = hashActivationToken(rawToken);

  const expiresAt = new Date(
    now.getTime() + PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000,
  );

  return prisma.$transaction(
    async (tx) => {
      // Invalidate previous unused password-reset tokens.
      await tx.accountActivationToken.updateMany({
        where: {
          userId: user.id,
          purpose: ActivationPurpose.PASSWORD_RESET,
          usedAt: null,
        },
        data: {
          usedAt: now,
        },
      });

      await tx.accountActivationToken.create({
        data: {
          userId: user.id,
          tokenHash,
          purpose: ActivationPurpose.PASSWORD_RESET,
          expiresAt,
        },
      });

      // The raw token is returned only for email delivery.
      return {
        email: user.email,
        token: rawToken,
        expiresAt,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
};

export const resetPassword = async (
  token: string,
  newPassword: string,
) => {
  if (!token || !newPassword) {
    throw new AppError("Token and password are required", 400);
  }

  const passwordHash = await hashPassword(newPassword);
  const tokenHash = hashActivationToken(token);
  const now = new Date();

  return prisma.$transaction(
    async (tx) => {
      const resetToken =
        await tx.accountActivationToken.findFirst({
          where: {
            tokenHash,
            purpose: ActivationPurpose.PASSWORD_RESET,
            usedAt: null,
            expiresAt: { gt: now },
          },
          select: {
            id: true,
            userId: true,
            user: {
              select: {
                id: true,
                status: true,
                credential: {
                  select: { id: true },
                },
              },
            },
          },
        });

      if (
        !resetToken ||
        resetToken.user.status !== "ACTIVE" ||
        !resetToken.user.credential
      ) {
        throw new AppError("Invalid or expired password reset token", 400);
      }

      // Consume the token exactly once.
      const consumed = await tx.accountActivationToken.updateMany({
        where: {
          id: resetToken.id,
          purpose: ActivationPurpose.PASSWORD_RESET,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          usedAt: now,
        },
      });

      if (consumed.count !== 1) {
        throw new AppError("Invalid or expired password reset token", 400);
      }

      // Update the existing credential.
      await tx.userCredential.update({
        where: {
          userId: resetToken.userId,
        },
        data: {
          passwordHash,
          passwordChangedAt: now,
        },
      });

      // Invalidate any other unused reset tokens.
      await tx.accountActivationToken.updateMany({
        where: {
          userId: resetToken.userId,
          purpose: ActivationPurpose.PASSWORD_RESET,
          usedAt: null,
        },
        data: {
          usedAt: now,
        },
      });

      // Revoke all active refresh-token sessions.
      await tx.userSession.updateMany({
        where: {
          userId: resetToken.userId,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      });

      return {
        message: "Password reset successfully",
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
};
