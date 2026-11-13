import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/token.js";

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      status: "error",
      message: "Authentication required",
    });
    return;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();

  if (!token) {
    res.status(401).json({
      status: "error",
      message: "Invalid authorization format",
    });
    return;
  }

  try {
    const payload = verifyAccessToken(token);

    req.auth = {
      userId: payload.userId,
    };

    next();
  } catch {
    res.status(401).json({
      status: "error",
      message: "Invalid or expired access token",
    });
  }
};