
import { describe, it, expect, vi, afterEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import errorHandler from "../../src/middleware/errorHandler.js";
import { AppError } from "../../src/utils/AppError.js";

describe("Error Handler Middleware", () => {
  const createMocks = (headersSent = false) => {
    const req = {} as Request;

    const res = {
      headersSent,
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    const next = vi.fn() as NextFunction;

    return { req, res, next };
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return the correct response for AppError", () => {
    const { req, res, next } = createMocks();

    errorHandler(
      new AppError("Invalid credentials", 401),
      req,
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      status: "fail",
      message: "Invalid credentials",
    });
  });

  it("should return a generic response for unexpected errors", () => {
    const { req, res, next } = createMocks();

    vi.spyOn(console, "error").mockImplementation(() => {});

    errorHandler(
      new Error("Database connection details"),
      req,
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      status: "error",
      message: "Internal server error",
    });
  });

  it("should pass the error to next if headers were already sent", () => {
    const { req, res, next } = createMocks(true);
    const error = new Error("Response already started");

    errorHandler(error, req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
