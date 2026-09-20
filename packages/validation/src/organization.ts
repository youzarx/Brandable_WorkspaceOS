import { z } from 'zod';

/**
 * Slug validation: lowercase, alphanumeric, hyphens allowed.
 * Must start and end with alphanumeric character.
 * 2-63 characters (DNS-safe length).
 */
const slugSchema = z
  .string()
  .min(2, 'Slug must be at least 2 characters')
  .max(63, 'Slug must be at most 63 characters')
  .regex(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
    'Slug must be lowercase alphanumeric with optional hyphens, and cannot start or end with a hyphen',
  );

/**
 * Create organization request validation.
 */
export const createOrganizationSchema = z.object({
  name: z
    .string()
    .min(1, 'Organization name is required')
    .max(255, 'Organization name is too long'),
  slug: slugSchema,
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

/**
 * Hex color validation (e.g., #6366f1).
 */
const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color (e.g., #6366f1)')
  .optional();

/**
 * Update organization request validation.
 * All fields optional — partial update.
 */
export const updateOrganizationSchema = z.object({
  name: z
    .string()
    .min(1, 'Organization name is required')
    .max(255, 'Organization name is too long')
    .optional(),
  logo: z.string().url('Logo must be a valid URL').optional(),
  favicon: z.string().url('Favicon must be a valid URL').optional(),
  primaryColor: hexColorSchema,
  secondaryColor: hexColorSchema,
  brandingConfig: z.record(z.unknown()).optional(),
});

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
