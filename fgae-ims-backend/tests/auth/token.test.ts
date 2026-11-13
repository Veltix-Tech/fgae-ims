
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  generateAccessToken,
  verifyAccessToken,
} from "../../src/utils/token.js";

describe("JWT access token", () => {
  const originalSecret = process.env.JWT_ACCESS_SECRET;

  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET =
      "test-secret-for-fgae-ims-automated-tests-123456";
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.JWT_ACCESS_SECRET;
    } else {
      process.env.JWT_ACCESS_SECRET = originalSecret;
    }
  });

  it("should generate an access token", () => {
    const token = generateAccessToken("user-123");

    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);
  });

  it("should verify a valid access token", () => {
    const token = generateAccessToken("user-123");

    const result = verifyAccessToken(token);

    expect(result.userId).toBe("user-123");
  });

  it("should reject an invalid token", () => {
    expect(() => verifyAccessToken("invalid-token")).toThrow();
  });

  it("should reject a tampered token", () => {
    const token = generateAccessToken("user-123");
    const tamperedToken =
      token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");

    expect(() => verifyAccessToken(tamperedToken)).toThrow();
  });
});
