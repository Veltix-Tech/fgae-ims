
import { describe, it, expect } from "vitest";
import { AppError } from "../../src/utils/AppError.js";

describe("AppError", () => {
  it("should create an application error", () => {
    const error = new AppError("Invalid credentials", 401);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error.message).toBe("Invalid credentials");
    expect(error.name).toBe("AppError");
  });

  it("should assign fail status to 4xx errors", () => {
    const error = new AppError("Not found", 404);

    expect(error.statusCode).toBe(404);
    expect(error.status).toBe("fail");
  });

  it("should assign error status to 5xx errors", () => {
    const error = new AppError("Server error", 500);

    expect(error.statusCode).toBe(500);
    expect(error.status).toBe("error");
  });

  it("should identify operational errors", () => {
    const error = new AppError("Insufficient budget", 400);

    expect(error.isOperational).toBe(true);
  });
});
