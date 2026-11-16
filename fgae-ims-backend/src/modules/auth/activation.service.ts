
import { ActivationPurpose, Prisma } from "@prisma/client";
import prisma from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { hashPassword } from "../../utils/password.js";
import {
  generateActivationToken,
  hashActivationToken,
} from "../../utils/activationToken.js";

const INVITATION_EXPIRY_HOURS = 24;

export const createAccountActivationInvitation = async (
  userId: string,
) => {
  const now = new Date();

  return prisma.$transaction(
    async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          status: true,
        },
      });

      if (!user) {
        throw new AppError("User not found", 404);
      }

      if (user.status !== "PENDING") {
        throw new AppError(
          "Only pending accounts can receive activation invitations",
          400,
        );
      }

      // Invalidate any previous unused activation invitations.
      await tx.accountActivationToken.updateMany({
        where: {
          userId,
          purpose: ActivationPurpose.ACCOUNT_ACTIVATION,
          usedAt: null,
        },
        data: {
          usedAt: now,
        },
      });

      // Generate a new secure token.
      const rawToken = generateActivationToken();
      const tokenHash = hashActivationToken(rawToken);

      const expiresAt = new Date(
        now.getTime() +
          INVITATION_EXPIRY_HOURS * 60 * 60 * 1000,
      );

      await tx.accountActivationToken.create({
        data: {
          userId,
          tokenHash,
          purpose: ActivationPurpose.ACCOUNT_ACTIVATION,
          expiresAt,
        },
      });

      // Return the raw token only so the caller can deliver the invitation.
      // Never store the raw token in the database.
      return {
        userId: user.id,
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


export const activateAccount = async (
  token: string,
  password: string,
) => {
  if (!token || !password) {
    throw new AppError("Token and password are required", 400);
  }

  // Hash the password before opening the transaction.
  const passwordHash = await hashPassword(password);
  const tokenHash = hashActivationToken(token);
  const now = new Date();

  return prisma.$transaction(
    async (tx) => {
      // 1. Find a valid, unused, unexpired invitation.
      const invitation =
        await tx.accountActivationToken.findFirst({
          where: {
            tokenHash,
            purpose: ActivationPurpose.ACCOUNT_ACTIVATION,
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
              },
            },
          },
        });

      if (!invitation) {
        throw new AppError(
          "Invalid or expired activation invitation",
          400,
        );
      }

      if (invitation.user.status !== "PENDING") {
        throw new AppError(
          "This account cannot be activated",
          400,
        );
      }

      // 2. Consume the token exactly once.
      const consumed =
        await tx.accountActivationToken.updateMany({
          where: {
            id: invitation.id,
            usedAt: null,
            expiresAt: { gt: now },
          },
          data: {
            usedAt: now,
          },
        });

      if (consumed.count !== 1) {
        throw new AppError(
          "This activation invitation has already been used",
          400,
        );
      }

      // 3. Create the user's credential.
      await tx.userCredential.create({
        data: {
          userId: invitation.userId,
          passwordHash,
          passwordChangedAt: now,
        },
      });

      // 4. Verify email and activate the account.
      const user = await tx.user.update({
        where: {
          id: invitation.userId,
        },
        data: {
          status: "ACTIVE",
          emailVerifiedAt: now,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          emailVerifiedAt: true,
        },
      });

      return {
        message: "Account activated successfully",
        user,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
};
