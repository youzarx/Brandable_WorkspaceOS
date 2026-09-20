import { z } from 'zod';

/**
 * Toggle module enabled/disabled for an organization.
 */
export const toggleModuleSchema = z.object({
  moduleId: z.string().min(1, 'Module ID is required'),
  isEnabled: z.boolean(),
});

export type ToggleModuleInput = z.infer<typeof toggleModuleSchema>;
