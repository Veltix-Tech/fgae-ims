
import { describe, expect, it } from "vitest";
import {
  changePasswordSchema,
} from "../../src/modules/auth/changePassword.validation.js";

describe("changePasswordSchema", () => {
  it("accepts valid password fields", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "Old-password-123",
        newPassword: "New-password-456",
      }).success,
    ).toBe(true);
  });

  it("rejects a missing current password", () => {
    expect(
      changePasswordSchema.safeParse({
        newPassword: "New-password-456",
      }).success,
    ).toBe(false);
  });

  it("rejects a missing new password", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "Old-password-123",
      }).success,
    ).toBe(false);
  });

  it("rejects a new password shorter than 12 characters", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "Old-password-123",
        newPassword: "short",
      }).success,
    ).toBe(false);
  });

  it("rejects a new password longer than 128 characters", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "Old-password-123",
        newPassword: "a".repeat(129),
      }).success,
    ).toBe(false);
  });
});
