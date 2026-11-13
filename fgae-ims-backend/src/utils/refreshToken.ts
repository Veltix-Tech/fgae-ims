import { randomBytes, createHash } from "node:crypto";

// Generate a secure random refresh token
export const generateRefreshToken = (): string => {
  return randomBytes(32).toString("hex");
};

// Hash the refresh token before storing it in the database
export const hashRefreshToken = (token: string): string => {
  return createHash("sha256")
    .update(token)
    .digest("hex");
};