
import prisma from "../../config/db.js";
import { verifyPassword } from "../../utils/password.js";
import { generateAccessToken } from "../../utils/token.js";
import {
  generateRefreshToken,
  hashRefreshToken,
} from "../../utils/refreshToken.js";

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface LoginUser {
  id: string;
  email: string;
  passwordHash: string;
  status: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
  };
}

export interface LoginMetadata {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

// Verify credentials and generate tokens.
export const authenticateUser = async (
  user: LoginUser | null,
  enteredPassword: string
): Promise<LoginResult> => {
  if (!user || user.status !== "ACTIVE") {
    throw new Error("Invalid email or password");
  }

  const passwordIsValid = await verifyPassword(
    user.passwordHash,
    enteredPassword
  );

  if (!passwordIsValid) {
    throw new Error("Invalid email or password");
  }

  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken();

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
    },
  };
};

// Authenticate against the actual database and persist the session.
export const loginWithDatabase = async (
  email: string,
  password: string,
  metadata: LoginMetadata = {}
): Promise<LoginResult> => {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { credential: true },
  });

  if (!user || !user.credential) {
    throw new Error("Invalid email or password");
  }

  const result = await authenticateUser(
    {
      id: user.id,
      email: user.email,
      passwordHash: user.credential.passwordHash,
      status: user.status,
    },
    password
  );

  const refreshTokenHash = hashRefreshToken(result.refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await prisma.$transaction([
    prisma.userSession.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        expiresAt,
        ipAddress: metadata.ipAddress ?? null,
        userAgent: metadata.userAgent ?? null,
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }),
  ]);

  return result;
};

export const refreshLoginSession = async (
  currentRefreshToken: string,
  metadata: LoginMetadata = {}
): Promise<LoginResult> => {
  const tokenHash = hashRefreshToken(currentRefreshToken);
  const now = new Date();

  const session = await prisma.userSession.findUnique({
    where: { refreshTokenHash: tokenHash },
    include: { user: true },
  });

  if (
    !session ||
    session.revokedAt ||
    session.expiresAt <= now ||
    session.user.status !== "ACTIVE"
  ) {
    throw new Error("Invalid refresh token");
  }

  const newRefreshToken = generateRefreshToken();
  const newRefreshTokenHash = hashRefreshToken(newRefreshToken);
  const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  // Atomically revoke the old token and create its replacement.
  const rotated = await prisma.$transaction(async (tx) => {
    const result = await tx.userSession.updateMany({
      where: {
        id: session.id,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: {
        revokedAt: now,
        lastUsedAt: now,
      },
    });

    if (result.count !== 1) {
      throw new Error("Invalid refresh token");
    }

    await tx.userSession.create({
      data: {
  userId: session.userId,
  refreshTokenHash: newRefreshTokenHash,
  expiresAt: newExpiresAt,
  ipAddress: metadata.ipAddress ?? null,
  userAgent: metadata.userAgent ?? null,
},
    });

    return true;
  });

  if (!rotated) {
    throw new Error("Invalid refresh token");
  }

  return {
    accessToken: generateAccessToken(session.userId),
    refreshToken: newRefreshToken,
    user: {
      id: session.user.id,
      email: session.user.email,
    },
  };
};

export const logoutUser = async (
  refreshToken: string
): Promise<void> => {
  await prisma.userSession.updateMany({
    where: {
      refreshTokenHash: hashRefreshToken(refreshToken),
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
};