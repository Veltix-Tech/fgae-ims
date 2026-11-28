import { describe, it, expect } from "vitest";
import {
  generateRefreshToken,
  hashRefreshToken,
} from "../../src/utils/refreshToken.js";

describe("Refresh token utilities", () => {
  it("should generate a random refresh token", () => {
    const token = generateRefreshToken();

    expect(typeof token).toBe("string");
    expect(token).toHaveLength(64);
  });

  it("should generate different tokens", () => {
    const token1 = generateRefreshToken();
    const token2 = generateRefreshToken();

    expect(token1).not.toBe(token2);
  });

  it("should hash a refresh token", () => {
    const token = generateRefreshToken();
    const hashedToken = hashRefreshToken(token);

    expect(hashedToken).toHaveLength(64);
    expect(hashedToken).not.toBe(token);
  });

  it("should produce the same hash for the same token", () => {
    const token = generateRefreshToken();

    expect(hashRefreshToken(token)).toBe(
      hashRefreshToken(token)
    );
  });
});