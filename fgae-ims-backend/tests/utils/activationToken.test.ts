
import { describe, expect, it } from "vitest";
import {
  generateActivationToken,
  hashActivationToken,
} from "../../src/utils/activationToken.js";

describe("Activation token utilities", () => {
  it("generates a secure 64-character hexadecimal token", () => {
    const token = generateActivationToken();

    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  it("generates unique tokens", () => {
    const first = generateActivationToken();
    const second = generateActivationToken();

    expect(first).not.toBe(second);
  });

  it("produces a consistent SHA-256 hash", () => {
    const token = generateActivationToken();

    expect(hashActivationToken(token)).toBe(
      hashActivationToken(token),
    );

    expect(hashActivationToken(token)).not.toBe(token);
  });

  it("produces different hashes for different tokens", () => {
    expect(hashActivationToken("token-one")).not.toBe(
      hashActivationToken("token-two"),
    );
  });
});
