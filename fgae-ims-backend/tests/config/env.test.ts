
import { describe, expect, it } from "vitest";
import { validateEnvironment } from "../../src/config/env.js";

const validEnvironment = {
  NODE_ENV: "production",
  PORT: "5000",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/test",
  DIRECT_URL: "postgresql://user:pass@localhost:5432/test",
  JWT_ACCESS_SECRET: "a".repeat(64),
  CORS_ORIGINS: "https://example.com",
  COOKIE_SAME_SITE: "lax",
  COOKIE_SECURE: "true",
  SMTP_HOST: "smtp.example.com",
  SMTP_PORT: "587",
  SMTP_SECURE: "false",
  SMTP_USER: "test@example.com",
  SMTP_PASS: "test-password",
  MAIL_FROM: "FGAE IMS <test@example.com>",
  APP_BASE_URL: "https://example.com",
};

describe("validateEnvironment", () => {
  it("accepts valid production configuration", () => {
    expect(() => validateEnvironment(validEnvironment)).not.toThrow();
  });

  it("rejects an unsupported NODE_ENV", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: "staging",
      }),
    ).toThrow(/NODE_ENV/);
  });

  it("rejects a missing database URL", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        DATABASE_URL: "",
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it("rejects a missing JWT secret", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        JWT_ACCESS_SECRET: "",
      }),
    ).toThrow(/JWT_ACCESS_SECRET/);
  });

  it("rejects a short JWT secret", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        JWT_ACCESS_SECRET: "short",
      }),
    ).toThrow(/at least 32 characters/);
  });

  it("rejects a production placeholder JWT secret", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        JWT_ACCESS_SECRET: "replace_with_a_long_random_secret",
      }),
    ).toThrow(/placeholder/);
  });

  it("rejects a missing production CORS origin", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        CORS_ORIGINS: "",
      }),
    ).toThrow(/CORS_ORIGINS/);
  });

  it("rejects an invalid port", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        PORT: "70000",
      }),
    ).toThrow(/PORT/);
  });

  it("rejects missing production email configuration", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        SMTP_HOST: "",
      }),
    ).toThrow(/SMTP_HOST/);
  });

  it("rejects an invalid application URL", () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        APP_BASE_URL: "not-a-url",
      }),
    ).toThrow(/APP_BASE_URL/);
  });
});
