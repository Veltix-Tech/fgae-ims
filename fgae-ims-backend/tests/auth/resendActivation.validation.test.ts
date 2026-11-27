import { describe, expect, it } from "vitest";
import {
  resendActivationSchema,
} from "../../src/modules/auth/auth.validation.js";

describe("Resend activation validation", () => {
  it("accepts a valid email", () => {
    const result = resendActivationSchema.safeParse({
      email: "staff@example.com",
    });

    expect(result.success).toBe(true);
  });

  it("normalizes email to lowercase", () => {
    const result = resendActivationSchema.safeParse({
      email: " STAFF@EXAMPLE.COM ",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.email).toBe("staff@example.com");
    }
  });

  it("rejects an invalid email", () => {
    const result = resendActivationSchema.safeParse({
      email: "not-an-email",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a missing email", () => {
    const result = resendActivationSchema.safeParse({});

    expect(result.success).toBe(false);
  });
});