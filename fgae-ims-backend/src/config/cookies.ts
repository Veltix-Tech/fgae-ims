import type { CookieOptions } from "express";

const configuredSameSite = (
  process.env.COOKIE_SAME_SITE ?? "lax"
).toLowerCase();

if (
  !["strict", "lax", "none"].includes(configuredSameSite)
) {
  throw new Error(
    "COOKIE_SAME_SITE must be strict, lax, or none",
  );
}

const sameSite = configuredSameSite as
  | "strict"
  | "lax"
  | "none";

const secure =
  process.env.NODE_ENV === "production" ||
  process.env.COOKIE_SECURE === "true";

if (sameSite === "none" && !secure) {
  throw new Error(
    "COOKIE_SECURE must be enabled when COOKIE_SAME_SITE=none",
  );
}

const refreshCookieBaseOptions: CookieOptions = {
  httpOnly: true,
  secure,
  sameSite,
  path: "/auth",
};

export const refreshCookieOptions: CookieOptions = {
  ...refreshCookieBaseOptions,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export const clearRefreshCookieOptions: CookieOptions = {
  ...refreshCookieBaseOptions,
};