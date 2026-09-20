/**
 * Standard API response envelope for successful responses.
 */
export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: ApiMeta;
}

/**
 * Standard API error response envelope.
 */
export interface ApiErrorResponse {
  success: false;
  error: ApiError;
}

/**
 * API error details.
 */
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Response metadata.
 */
export interface ApiMeta {
  requestId?: string;
}

/**
 * Paginated response extending the standard API response.
 */
export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: PaginationMeta;
  meta?: ApiMeta;
}

/**
 * Pagination metadata.
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * Pagination query parameters.
 */
export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}
