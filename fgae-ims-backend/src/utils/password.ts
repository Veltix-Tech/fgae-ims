
import argon2 from "argon2";

// Hash a password before saving it in the database
export const hashPassword = async (
  password: string
): Promise<string> => {
  return await argon2.hash(password, {
    type: argon2.argon2id,
  });
};

// Verify an entered password against its stored hash
export const verifyPassword = async (
  hashedPassword: string,
  enteredPassword: string
): Promise<boolean> => {
  return await argon2.verify(hashedPassword, enteredPassword);
};
