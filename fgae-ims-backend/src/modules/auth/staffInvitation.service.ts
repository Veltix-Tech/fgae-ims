
import { createStaffAccount } from "./accountManagement.service.js";
import { createAccountActivationInvitation } from "./activation.service.js";
import { sendAccountActivationEmail } from "./email.service.js";

type CreateStaffInvitationInput = Parameters<
  typeof createStaffAccount
>[0];

export const createStaffAccountWithInvitation = async (
  input: CreateStaffInvitationInput,
) => {
  // 1. Create the staff account and its role/scope assignments.
  const account = await createStaffAccount(input);

  // 2. Generate and store a hashed activation token.
  const invitation = await createAccountActivationInvitation(
    account.user.id,
  );

  // 3. Send the email outside the database transactions.
  try {
    await sendAccountActivationEmail({
      email: invitation.email,
      token: invitation.token,
      expiresAt: invitation.expiresAt,
    });

    return {
      ...account,
      invitationSent: true,
    };
  } catch {
    // The account and invitation still exist.
    // A resend operation can deliver another invitation later.
    return {
      ...account,
      invitationSent: false,
    };
  }
};
