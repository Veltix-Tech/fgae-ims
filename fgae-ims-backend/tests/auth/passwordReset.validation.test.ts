
import { describe, expect, it } from "vitest";
import {
  requestPasswordResetSchema,
  confirmPasswordResetSchema,
} from "../../src/modules/auth/passwordReset.validation.js";

describe("requestPasswordResetSchema", () => {
  it("accepts a valid email and normalizes it", () => {
    expect(
      requestPasswordResetSchema.parse({
        email: " USER@EXAMPLE.COM ",
      }),
    ).toEqual({
      email: "user@example.com",
    });
  });

  it("rejects an invalid email", () => {
    expect(
      requestPasswordResetSchema.safeParse({
        email: "not-an-email",
      }).success,
    ).toBe(false);
  });

  it("rejects a missing email", () => {
    expect(
      requestPasswordResetSchema.safeParse({}).success,
    ).toBe(false);
  });
});

describe("confirmPasswordResetSchema", () => {
  it("accepts a valid token and password", () => {
    expect(
      confirmPasswordResetSchema.safeParse({
        token: "valid-token",
        newPassword: "A-strong-new-password-123",
      }).success,
    ).toBe(true);
  });

  it("rejects an empty token", () => {
    expect(
      confirmPasswordResetSchema.safeParse({
        token: "",
        newPassword: "A-strong-new-password-123",
      }).success,
    ).toBe(false);
  });

  it("rejects a password shorter than 12 characters", () => {
    expect(
      confirmPasswordResetSchema.safeParse({
        token: "valid-token",
        newPassword: "short",
      }).success,
    ).toBe(false);
  });

  it("rejects a password longer than 128 characters", () => {
    expect(
      confirmPasswordResetSchema.safeParse({
        token: "valid-token",
        newPassword: "a".repeat(129),
      }).success,
    ).toBe(false);
  });
});
