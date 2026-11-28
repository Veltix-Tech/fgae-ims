
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import "dotenv/config";

// JWT configuration
const JWT_ISSUER = "fgae-ims";
const JWT_AUDIENCE = "fgae-ims-api";
const ACCESS_TOKEN_EXPIRY = 15 * 60;

const getJwtSecret = (): string => {
  const secret = process.env.JWT_ACCESS_SECRET;

  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET is not configured");
  }

  return secret;
};

export interface AccessTokenPayload {
  userId: string;
  sessionId: string;
}

// Every access token identifies both its user and its database session.
export const generateAccessToken = (
  userId: string,
  sessionId: string = randomUUID(),
): string => {
  return jwt.sign(
    { sid: sessionId },
    getJwtSecret(),
    {
      algorithm: "HS256",
      subject: userId,
      expiresIn: ACCESS_TOKEN_EXPIRY,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    },
  );
};

export const verifyAccessToken = (
  token: string,
): AccessTokenPayload => {
  const decoded = jwt.verify(token, getJwtSecret(), {
    algorithms: ["HS256"],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });

  if (
    typeof decoded === "string" ||
    typeof decoded.sub !== "string" ||
    typeof decoded.sid !== "string"
  ) {
    throw new Error("Invalid access token payload");
  }

  return {
    userId: decoded.sub,
    sessionId: decoded.sid,
  };
};
