
import type { Request, Response, NextFunction } from "express";
import {
  createPasswordResetRequest,
  resetPassword,
} from "./passwordReset.service.js";
import { sendPasswordResetEmail } from "./email.service.js";

export const requestPasswordReset = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email } = req.body;

    const resetRequest = await createPasswordResetRequest(email);

    if (resetRequest) {
      await sendPasswordResetEmail({
        email: resetRequest.email,
        token: resetRequest.token,
        expiresAt: resetRequest.expiresAt,
      });
    }

    // Same response whether the account exists or not.
    return res.status(200).json({
      message:
        "If an eligible account exists for that email, a password reset link has been sent.",
    });
  } catch (error) {
    return next(error);
  }
};

export const confirmPasswordReset = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { token, newPassword } = req.body;

    const result = await resetPassword(token, newPassword);

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};
