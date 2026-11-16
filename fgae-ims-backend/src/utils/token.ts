
import jwt from "jsonwebtoken";
import "dotenv/config";

// JWT configuration
const JWT_ISSUER = "fgae-ims";
const JWT_AUDIENCE = "fgae-ims-api";
const ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutes in seconds

// Get the secret from environment variables
const getJwtSecret = (): string => {
  const secret = process.env.JWT_ACCESS_SECRET;

  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET is not configured");
  }

  return secret;
};

// Generate an access token for a user
export const generateAccessToken = (userId: string): string => {
  const token = jwt.sign(
    {},
    getJwtSecret(),
    {
      algorithm: "HS256",
      subject: userId,
      expiresIn: ACCESS_TOKEN_EXPIRY,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }
  );

  return token;
};

// Verify an access token
export const verifyAccessToken = (
  token: string
): { userId: string } => {
  const decoded = jwt.verify(token, getJwtSecret(), {
    algorithms: ["HS256"],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });

  if (typeof decoded === "string" || typeof decoded.sub !== "string") {
    throw new Error("Invalid access token payload");
  }

  return {
    userId: decoded.sub,
  };
};
