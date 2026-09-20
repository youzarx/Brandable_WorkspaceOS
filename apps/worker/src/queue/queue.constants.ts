/**
 * Deterministic queue namespace constants for the platform worker foundation.
 * Business module queues will be added in future business implementation phases.
 */
export const QUEUE_NAMES = {
  SYSTEM: 'system_default',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const ALL_QUEUE_NAMES = Object.values(QUEUE_NAMES);
