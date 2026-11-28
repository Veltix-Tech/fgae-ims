import type { Request, Response, NextFunction } from "express";
import { isAllowedOrigin } from "../config/origins.js";

export const requireTrustedOrigin = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const origin = req.get("Origin");

  if (!origin || !isAllowedOrigin(origin)) {
    res.status(403).json({
      status: "error",
      message: "Request origin is not allowed",
    });
    return;
  }

  next();
};