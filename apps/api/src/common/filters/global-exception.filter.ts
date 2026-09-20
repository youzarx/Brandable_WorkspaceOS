import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = (request.headers['x-request-id'] as string) || 'none';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorResponse: Record<string, unknown> = {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        errorResponse = { message: res };
      } else if (typeof res === 'object' && res !== null) {
        errorResponse = res as Record<string, unknown>;
      }
    } else {
      this.logger.error(
        `Unhandled Exception [RequestID: ${requestId}]: ${(exception as Error).message}`,
        (exception as Error).stack,
      );
    }

    // Ensure password hashes or sensitive fields are never present in error response
    if (errorResponse['passwordHash']) delete errorResponse['passwordHash'];
    if (errorResponse['tokenHash']) delete errorResponse['tokenHash'];
    if (errorResponse['refreshToken']) delete errorResponse['refreshToken'];

    response.status(status).json({
      statusCode: status,
      error: errorResponse['error'] || errorResponse['code'] || 'ERROR',
      message: errorResponse['message'] || 'An error occurred',
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId,
    });
  }
}
