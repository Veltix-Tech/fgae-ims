
import type { ErrorRequestHandler } from "express";
import { AppError } from "../utils/AppError.js";

const errorHandler: ErrorRequestHandler = (
  err,
  req,
  res,
  next
) => {
  // If the response has already started, pass the error onward.
  if (res.headersSent) {
    next(err);
    return;
  }

  // Handle errors we intentionally throw in our application.
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
    return;
  }

  // Log unexpected errors for developers.
  console.error("Unexpected error:", err);

  // Never expose internal error details to clients.
  res.status(500).json({
    status: "error",
    message: "Internal server error",
  });
};

export default errorHandler;
