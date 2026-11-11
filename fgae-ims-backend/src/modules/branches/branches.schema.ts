
import { z } from 'zod';

// Allowed organization unit types
export const organizationUnitTypeSchema = z.enum([
  'HEAD_OFFICE',
  'AREA_OFFICE',
  'BRANCH',
  'HEALTH_FACILITY',
]);

// Allowed organization unit statuses
export const organizationUnitStatusSchema = z.enum([
  'ACTIVE',
  'INACTIVE',
]);
export const createOrganizationUnitSchema = z.object({
  name: z.string().min(1, 'Name is required'),

  code: z.string().min(1, 'Code is required'),

  type: organizationUnitTypeSchema,

  status: organizationUnitStatusSchema,

  parentId: z.string().uuid('Invalid parent ID').nullable().optional(),
});

export const updateOrganizationUnitSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),

  code: z.string().min(1, 'Code is required').optional(),

  type: organizationUnitTypeSchema.optional(),

  status: organizationUnitStatusSchema.optional(),

  parentId: z.string().uuid('Invalid parent ID').nullable().optional(),
});

// Validate organization unit ID from request parameters
export const organizationUnitIdSchema = z.object({
  id: z.string().uuid('Invalid organization unit ID'),
});

export type CreateOrganizationUnitInput = z.infer<
  typeof createOrganizationUnitSchema
>;

export type UpdateOrganizationUnitInput = z.infer<
  typeof updateOrganizationUnitSchema
>;
