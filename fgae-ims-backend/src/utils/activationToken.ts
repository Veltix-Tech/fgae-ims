
import { createHash, randomBytes } from "node:crypto";

/**
 * Generates a cryptographically secure, opaque activation token.
 * The raw token is sent to the staff member only through the invitation link.
 */
export const generateActivationToken = (): string => {
  return randomBytes(32).toString("hex");
};

/**
 * Stores a SHA-256 hash instead of the raw activation token.
 */
export const hashActivationToken = (token: string): string => {
  return createHash("sha256")
    .update(token)
    .digest("hex");
};
