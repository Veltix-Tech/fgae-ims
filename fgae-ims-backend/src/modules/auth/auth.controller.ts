
import type { Request, Response, NextFunction } from "express";
import { createStaffAccountWithInvitation } from "./staffInvitation.service.js";
import { activateAccount } from "./activation.service.js";
import { resendActivationInvitation } from "./resendActivation.service.js";
import { getCurrentUser } from "./currentUser.service.js";
import { AppError } from "../../utils/AppError.js";
import { loginWithDatabase,
         refreshLoginSession,
         logoutUser,
         logoutAllUserSessions,
 } from "./auth.service.js";

import {
  refreshCookieOptions,
  clearRefreshCookieOptions,
} from "../../config/cookies.js";

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await loginWithDatabase(
      req.body.email,
      req.body.password,
      {
        ipAddress: req.ip,
        userAgent: req.get("user-agent") ?? undefined,
      }
    );

    // Keep the refresh token in an HTTP-only cookie.
    res.cookie("refreshToken", result.refreshToken, refreshCookieOptions);

    res.status(200).json({
      status: "success",
      message: "Login successful",
      data: {
        accessToken: result.accessToken,
        user: result.user,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Invalid email or password"
    ) {
      res.status(401).json({
        status: "error",
        message: "Invalid email or password",
      });
      return;
    }

    next(error);
  }
};


export const refresh = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentToken = req.cookies?.refreshToken;

    if (!currentToken) {
      res.status(401).json({
        status: "error",
        message: "Refresh token required",
      });
      return;
    }

    const result = await refreshLoginSession(currentToken, {
      ipAddress: req.ip,
      userAgent: req.get("user-agent") ?? undefined,
    });

    res.cookie("refreshToken", result.refreshToken, refreshCookieOptions);

    res.status(200).json({
      status: "success",
      message: "Session refreshed",
      data: {
        accessToken: result.accessToken,
        user: result.user,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid refresh token") {
      res.clearCookie("refreshToken", clearRefreshCookieOptions);
      res.status(401).json({
        status: "error",
        message: "Invalid or expired refresh token",
      });
      return;
    }

    next(error);
  }
};

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentToken = req.cookies?.refreshToken;

    if (currentToken) {
      await logoutUser(currentToken);
    }

    res.clearCookie("refreshToken", clearRefreshCookieOptions);

    res.status(200).json({
      status: "success",
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const logoutAll = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      throw new AppError("Authentication required", 401);
    }

    await logoutAllUserSessions(userId);

    res.clearCookie("refreshToken", clearRefreshCookieOptions);

    res.status(200).json({
      status: "success",
      message: "Logged out from all devices successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const createStaff = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const actorId = req.auth?.userId;

    if (!actorId) {
      res.status(401).json({
        status: "error",
        message: "Authentication required",
      });
      return;
    }

    const result = await createStaffAccountWithInvitation({
      ...req.body,
      actorId,
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get("user-agent") ?? undefined,
      },
    });

    res.status(201).json({
      status: "success",
      message: result.invitationSent
        ? "Staff account created and activation invitation sent"
        : "Staff account created, but activation email could not be sent",
      data: {
        user: result.user,
        role: result.role,
        organizationId: result.organizationId,
        areaId: result.areaId,
        branchId: result.branchId,
        invitationSent: result.invitationSent,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const activate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { activationToken, password } = req.body;

    await activateAccount(activationToken, password);

    return res.status(200).json({
      message: "Account activated successfully.",
    });
  } catch (error) {
    next(error);
  }
};

export const resendActivation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.body;

    await resendActivationInvitation(email);

    return res.status(200).json({
      message:
        "If an eligible account exists, an activation invitation will be sent.",
    });
  } catch (error) {
    next(error);
  }
};


export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return next(new AppError("Authentication required", 401));
    }

    const user = await getCurrentUser(userId);

    return res.status(200).json({
      user,
    });
  } catch (error) {
    return next(error);
  }
};
