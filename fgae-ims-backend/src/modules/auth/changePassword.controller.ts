
import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../utils/AppError.js";
import { changePassword as changeUserPassword } from "./changePassword.service.js";

export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      throw new AppError("Authentication required", 401);
    }

    const { currentPassword, newPassword } = req.body;

    const result = await changeUserPassword(
      userId,
      currentPassword,
      newPassword,
    );

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
};
