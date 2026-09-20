/**
 * Platform permission keys.
 * Format: <resource>.<action>
 * These are string constants — NOT an enum.
 * New permissions are added by inserting rows in the Permission table.
 */
export const PERMISSIONS = {
  // Organizations
  ORGANIZATIONS_READ: 'organizations.read',
  ORGANIZATIONS_UPDATE: 'organizations.update',
  ORGANIZATIONS_DELETE: 'organizations.delete',

  // Users
  USERS_READ: 'users.read',
  USERS_UPDATE: 'users.update',
  USERS_INVITE: 'users.invite',
  USERS_REMOVE: 'users.remove',

  // Roles
  ROLES_READ: 'roles.read',
  ROLES_MANAGE: 'roles.manage',

  // Permissions
  PERMISSIONS_READ: 'permissions.read',

  // Memberships
  MEMBERSHIPS_READ: 'memberships.read',
  MEMBERSHIPS_MANAGE: 'memberships.manage',

  // Settings
  SETTINGS_READ: 'settings.read',
  SETTINGS_UPDATE: 'settings.update',

  // Modules
  MODULES_READ: 'modules.read',
  MODULES_CONFIGURE: 'modules.configure',

  // Audit
  AUDIT_READ: 'audit.read',
} as const;

/** All permission key values as an array */
export const ALL_PERMISSION_KEYS = Object.values(PERMISSIONS);

/** Type representing any valid permission key */
export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
