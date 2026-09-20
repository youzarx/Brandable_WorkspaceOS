/**
 * System role name constants.
 * System roles have organizationId = NULL and isSystem = true.
 * These are seeded at database initialization.
 */
export const SYSTEM_ROLES = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
} as const;

export type SystemRoleName = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];
