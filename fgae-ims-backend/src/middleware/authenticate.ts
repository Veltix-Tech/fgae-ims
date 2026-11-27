
import type { RequestHandler } from "express";
import prisma from "../config/db.js";
import { verifyAccessToken } from "../utils/token.js";
import { AppError } from "../utils/AppError.js";

export const authenticate: RequestHandler = async (
  req,
  res,
  next,
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    next(new AppError("Authentication required", 401));
    return;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();

  if (!token) {
    next(new AppError("Invalid authorization format", 401));
    return;
  }

  let payload;

  try {
    payload = verifyAccessToken(token);
  } catch {
    next(new AppError("Invalid or expired access token", 401));
    return;
  }

  try {
    const session = await prisma.userSession.findUnique({
      where: {
        id: payload.sessionId,
      },
      select: {
        id: true,
        userId: true,
        revokedAt: true,
        expiresAt: true,
        user: {
          select: {
            status: true,
          },
        },
      },
    });

    if (
      !session ||
      session.userId !== payload.userId ||
      session.revokedAt !== null ||
      session.expiresAt <= new Date() ||
      session.user.status !== "ACTIVE"
    ) {
      next(new AppError("Session is invalid or has expired", 401));
      return;
    }

    req.userId = payload.userId;

    req.auth = {
      userId: payload.userId,
      sessionId: payload.sessionId,
    };

    next();
  } catch (error) {
    // Database failures should reach the error handler,
    // not be incorrectly reported as invalid credentials.
    next(error);
  }
};
