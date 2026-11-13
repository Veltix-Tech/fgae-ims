import type { Request, Response, NextFunction } from "express";
import type { ZodType } from "zod";

// Reusable middleware for validating request bodies
export const validate = (schema: ZodType) => {
  return (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        status: "error",
        message: "Validation failed",
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });

      return;
    }

    req.body = result.data;
    next();
  };
};