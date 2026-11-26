
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "vitest";
import jwt from "jsonwebtoken";

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
    const token = generateAccessToken(
      "user-123",
      "session-123",
    );

    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);
  });

  it("should verify a valid access token and return its session ID", () => {
    const token = generateAccessToken(
      "user-123",
      "session-123",
    );

    const result = verifyAccessToken(token);

    expect(result).toEqual({
      userId: "user-123",
      sessionId: "session-123",
    });
  });

  it("should reject an invalid token", () => {
    expect(() => verifyAccessToken("invalid-token")).toThrow();
  });

  it("should reject a tampered token", () => {
    const token = generateAccessToken(
      "user-123",
      "session-123",
    );

    const tamperedToken =
      token.slice(0, -1) +
      (token.endsWith("a") ? "b" : "a");

    expect(() => verifyAccessToken(tamperedToken)).toThrow();
  });

  it("should reject a token without a session ID", () => {
    const jwt = require("jsonwebtoken");

    const token = jwt.sign(
      {},
      process.env.JWT_ACCESS_SECRET,
      {
        algorithm: "HS256",
        subject: "user-123",
        expiresIn: 900,
        issuer: "fgae-ims",
        audience: "fgae-ims-api",
      },
    );

    expect(() => verifyAccessToken(token)).toThrow(
      "Invalid access token payload",
    );
  });
});
