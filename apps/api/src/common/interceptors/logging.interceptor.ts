import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';
import crypto from 'crypto';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();

    const requestId = (request.headers['x-request-id'] as string) || crypto.randomUUID();
    request.headers['x-request-id'] = requestId;
    response.setHeader('X-Request-Id', requestId);

    const startTime = Date.now();
    const { method, url } = request;

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;
        const userId = (request as any).user?.id || 'anonymous';

        this.logger.log(
          JSON.stringify({
            requestId,
            userId,
            method,
            url,
            statusCode,
            durationMs: duration,
          }),
        );
      }),
    );
  }
}
