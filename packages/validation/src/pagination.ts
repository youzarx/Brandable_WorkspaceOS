import { z } from 'zod';

/**
 * Pagination query parameter validation.
 * Defaults: page = 1, pageSize = 20.
 * Max pageSize = 100 to prevent abuse.
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationInput = z.infer<typeof paginationSchema>;
