import { z } from 'zod';

/**
 * Environment variable validation schema.
 * Matches the variables documented in .env.example.
 * Used by the API ConfigModule to validate env at startup.
 */
export const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_NAME: z.string().default('Platform'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  API_URL: z.string().url().default('http://localhost:3001'),

  // API Server
  API_PORT: z.coerce.number().int().positive().default(3001),
  API_PREFIX: z.string().default('/api'),
  API_VERSION: z.string().default('v1'),
  API_BODY_LIMIT_MB: z.coerce.number().int().positive().default(10),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY_DAYS: z.coerce.number().int().positive().default(7),

  // Cookie
  COOKIE_SECRET: z.string().min(32, 'Cookie secret must be at least 32 characters'),
  COOKIE_SAME_SITE: z.enum(['Strict', 'Lax', 'None']).default('Strict'),
  COOKIE_DOMAIN: z.string().optional(),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Redis (optional in Phase 2)
  REDIS_URL: z.string().optional(),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_AUTH_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_FALLBACK_AUTH_MAX: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_FALLBACK_AUTH_WINDOW_MS: z.coerce.number().int().positive().default(900000),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug', 'verbose']).default('debug'),
});

export type EnvConfig = z.infer<typeof envSchema>;
