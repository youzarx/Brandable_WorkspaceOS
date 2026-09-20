/**
 * @platform/database — Prisma Client Export
 *
 * This package provides the Prisma client and generated types for the platform.
 * It is imported by apps/api and apps/worker.
 *
 * RULES:
 *   - This package does NOT depend on NestJS.
 *   - The PrismaClient singleton is created lazily.
 *   - Consumers are responsible for connecting/disconnecting.
 *   - Generated Prisma types are re-exported for convenience.
 */

import { PrismaClient } from '@prisma/client';

/**
 * Creates a new PrismaClient instance with logging configuration
 * based on the NODE_ENV environment variable.
 */
function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env['NODE_ENV'] === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
  });
}

/**
 * Singleton PrismaClient instance for the platform.
 * Use this in application code. For tests, create a new instance.
 */
export const prisma = createPrismaClient();

// Re-export Prisma types for consumers
export { PrismaClient } from '@prisma/client';
export { Prisma } from '@prisma/client';

// Re-export generated model types and enums
export { MembershipStatus } from '@prisma/client';

// Export the factory for testing
export { createPrismaClient };
