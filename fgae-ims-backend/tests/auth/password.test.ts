
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../../src/utils/password.js";

describe("Password utilities", () => {
  it("should hash a password", async () => {
    const password = "TestPassword123!";

    const hashedPassword = await hashPassword(password);

    expect(hashedPassword).not.toBe(password);
    expect(hashedPassword).toContain("$argon2id$");
  });

  it("should verify the correct password", async () => {
    const password = "TestPassword123!";
    const hashedPassword = await hashPassword(password);

    const result = await verifyPassword(hashedPassword, password);

    expect(result).toBe(true);
  });

  it("should reject an incorrect password", async () => {
    const hashedPassword = await hashPassword("TestPassword123!");

    const result = await verifyPassword(
      hashedPassword,
      "WrongPassword"
    );

    expect(result).toBe(false);
  });
});
