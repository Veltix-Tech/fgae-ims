
import type { RequestHandler } from "express";
import { verifyAccessToken } from "../utils/token.js";
import { AppError } from "../utils/AppError.js";

export const authenticate: RequestHandler = (
  req,
  res,
  next
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

  try {
    const payload = verifyAccessToken(token);

    req.auth = {
      userId: payload.userId,
    };

    next();
  } catch {
    next(new AppError("Invalid or expired access token", 401));
  }
};
