/**
 * Platform module key constants.
 * Module keys are dynamic strings — NOT a Prisma enum.
 * Adding a new module requires only a new row in the Module table.
 */
export const MODULE_KEYS = {
  PROJECTS: 'projects',
  TASKS: 'tasks',
  INVOICES: 'invoices',
  CRM: 'crm',
  CALENDAR: 'calendar',
  CHAT: 'chat',
  CONTENT: 'content',
  ANALYTICS: 'analytics',
} as const;

/** All module key values as an array */
export const ALL_MODULE_KEYS = Object.values(MODULE_KEYS);

/** Type representing any known module key */
export type ModuleKey = (typeof MODULE_KEYS)[keyof typeof MODULE_KEYS];
