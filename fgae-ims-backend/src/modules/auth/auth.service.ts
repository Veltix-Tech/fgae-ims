import { verifyPassword } from "../../utils/password.js";
import { generateAccessToken } from "../../utils/token.js";
import {
  generateRefreshToken,
  hashRefreshToken,
} from "../../utils/refreshToken.js";

// These types describe the information login needs.
// They do not create or replace Prisma database models.
export interface LoginUser {
  id: string;
  email: string;
  passwordHash: string;
  status: string;
}

// Authentication result
export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
  };
}

// Verify a user's credentials
export const authenticateUser = async (
  user: LoginUser | null,
  enteredPassword: string
): Promise<LoginResult> => {
  // Check whether the account exists
  if (!user) {
    throw new Error("Invalid email or password");
  }

  // Check whether the account is active
  if (user.status !== "ACTIVE") {
    throw new Error("Account is not active");
  }

  // Verify the entered password
  const passwordIsValid = await verifyPassword(
    user.passwordHash,
    enteredPassword
  );

  if (!passwordIsValid) {
    throw new Error("Invalid email or password");
  }

  // Generate access and refresh tokens
  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken();

  // Hash the refresh token before storing it
  const hashedRefreshToken = hashRefreshToken(refreshToken);

  // TODO: Store hashedRefreshToken in the database
  // after the shared Prisma session schema is ready.

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
    },
  };
};