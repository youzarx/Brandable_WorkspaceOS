import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

@Injectable()
export class InProcessRateLimiterService {
  private readonly limits = new Map<string, RateLimitEntry>();

  /**
   * Enforces in-process rate limits for sensitive authentication endpoints.
   * @param key IP address or identifier
   * @param maxRequests Maximum requests per window (default: 5)
   * @param windowMs Window duration in milliseconds (default: 15 minutes = 900000ms)
   */
  checkRateLimit(key: string, maxRequests: number = 5, windowMs: number = 900000): void {
    const now = Date.now();
    const entry = this.limits.get(key);

    if (!entry || now - entry.windowStart > windowMs) {
      this.limits.set(key, { count: 1, windowStart: now });
      return;
    }

    if (entry.count >= maxRequests) {
      throw new HttpException(
        {
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many authentication attempts. Please try again later.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    entry.count += 1;
  }
}
