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


export const createStaffSchema = z.object({
  email: z.string().trim().email("Please provide a valid email address").max(254),

  phone: z.string().trim().min(1).max(30).optional(),

  firstName: z.string().trim().min(1).max(100),
  middleName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().min(1).max(100),

  roleCode: z.enum([
    "SUPER_ADMIN",
    "AREA_MANAGER",
    "PROJECT_MANAGER",
    "BRANCH_MANAGER",
    "VOLUNTEER_MANAGER",
    "FIELD_SUPERVISOR",
    "HR_OFFICER",
    "FINANCE_OFFICER",
    "VOLUNTEER",
  ]),

  organizationId: z.string().uuid("Invalid organization ID"),
  areaId: z.string().uuid("Invalid area ID").optional(),
  branchId: z.string().uuid("Invalid branch ID").optional(),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
