import { z } from 'zod';

/**
 * Invite member request validation.
 */
export const inviteMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  roleId: z.string().min(1, 'Role ID is required'),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

/**
 * Update member role request validation.
 */
export const updateMemberRoleSchema = z.object({
  roleId: z.string().min(1, 'Role ID is required'),
});

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
