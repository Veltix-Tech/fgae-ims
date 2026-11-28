
import { z } from "zod";

export const requestPasswordResetSchema = z.object({
  email: z
    .string()
    .trim()
    .email("A valid email address is required")
    .max(254)
    .transform((email) => email.toLowerCase()),
});

export const confirmPasswordResetSchema = z.object({
  token: z.string().trim().min(1).max(256),
  newPassword: z.string().min(12).max(128),
});

export type RequestPasswordResetInput = z.infer<
  typeof requestPasswordResetSchema
>;

export type ConfirmPasswordResetInput = z.infer<
  typeof confirmPasswordResetSchema
>;
