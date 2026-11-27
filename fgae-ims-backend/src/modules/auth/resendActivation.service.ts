
import prisma from "../../config/db.js";
import { createAccountActivationInvitation } from "./activation.service.js";
import { sendAccountActivationEmail } from "./email.service.js";

export const resendActivationInvitation = async (email: string) => {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
    select: {
      id: true,
      status: true,
    },
  });

  // Do not reveal whether an account exists or its current status.
  if (!user || user.status !== "PENDING") {
    return;
  }

  // Generate a fresh invitation and invalidate previous unused tokens.
  const invitation = await createAccountActivationInvitation(user.id);

  // Email delivery happens outside the database transaction.
  // Do not reveal delivery details through this public endpoint.
  try {
    await sendAccountActivationEmail({
      email: normalizedEmail,
      token: invitation.token,
      expiresAt: invitation.expiresAt,
    });
  } catch {
    // The pending account and new invitation remain available.
    // The public response stays generic.
  }
};
