import { z } from "zod";

export const loginSchema = z.object({
  email: z.string()
    .trim()
    .email("Please provide a valid email address")
    .max(254),

  password: z.string()
    .min(1, "Password is required")
    .max(128, "Password is too long"),
});

export const activateSchema = z.object({
  activationToken: z.string()
    .min(1, "Activation token is required"),

  password: z.string()
    .min(12, "Password must contain at least 12 characters")
    .max(128, "Password is too long"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ActivateInput = z.infer<typeof activateSchema>;