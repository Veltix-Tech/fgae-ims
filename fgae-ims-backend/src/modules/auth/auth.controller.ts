import type { Request, Response } from "express";

// Temporary login controller
export const login = (
  req: Request,
  res: Response
): void => {
  res.status(200).json({
    status: "success",
    message: "Login validation successful",
  });
};