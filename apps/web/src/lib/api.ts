import { WEB_CONFIG } from './config';
import type { ApiResponse, ApiErrorResponse } from '@platform/types';

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// In-memory token reference (Never persisted to localStorage/sessionStorage/cookies)
let inMemoryAccessToken: string | null = null;

export function getInMemoryAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function setInMemoryAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
}

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
  skipRetry?: boolean;
}

/**
 * Lightweight typed API client over native fetch.
 * Sends credentials: 'include' for HttpOnly refresh cookies.
 * Attaches short-lived access token from memory if present.
 */
export async function apiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuth = false, skipRetry = false, headers: customHeaders, ...restOptions } = options;

  const url = endpoint.startsWith('http')
    ? endpoint
    : `${WEB_CONFIG.apiBaseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>),
  };

  if (!skipAuth && inMemoryAccessToken) {
    headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;
  }

  const response = await fetch(url, {
    ...restOptions,
    headers,
    credentials: 'include',
  });

  // Transparent 401 Recovery via /auth/refresh
  if (response.status === 401 && !skipAuth && !skipRetry && endpoint !== '/auth/refresh') {
    const newAccessToken = await refreshAccessTokenSingleAttempt();
    if (newAccessToken) {
      // Retry original request once with new token
      return apiRequest<T>(endpoint, {
        ...options,
        skipRetry: true,
        headers: {
          ...customHeaders,
          Authorization: `Bearer ${newAccessToken}`,
        },
      });
    }
  }

  const responseText = await response.text();
  let json: unknown;
  try {
    json = JSON.parse(responseText);
  } catch {
    if (!response.ok) {
      throw new ApiError(
        response.status,
        'HTTP_ERROR',
        `Request failed with status ${response.status}`,
      );
    }
    return responseText as unknown as T;
  }

  if (!response.ok) {
    const errorJson = json as Partial<ApiErrorResponse>;
    const errCode = errorJson?.error?.code || 'UNKNOWN_ERROR';
    const errMessage = errorJson?.error?.message || `Request failed (${response.status})`;
    throw new ApiError(response.status, errCode, errMessage, errorJson?.error?.details);
  }

  // Handle standard ApiResponse envelope
  const apiResp = json as Partial<ApiResponse<T>>;
  if (apiResp && typeof apiResp === 'object' && 'success' in apiResp && apiResp.success === true) {
    return apiResp.data as T;
  }

  return json as T;
}

/**
 * Single-attempt refresh token rotation over /auth/refresh.
 * Prevents concurrent refresh stampedes.
 */
async function refreshAccessTokenSingleAttempt(): Promise<string | null> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${WEB_CONFIG.apiBaseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) {
        setInMemoryAccessToken(null);
        return null;
      }

      const json = (await response.json()) as ApiResponse<{ accessToken: string }>;
      const newToken = json?.data?.accessToken;
      if (newToken) {
        setInMemoryAccessToken(newToken);
        return newToken;
      }
      setInMemoryAccessToken(null);
      return null;
    } catch {
      setInMemoryAccessToken(null);
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function buildOptions(
  method: string,
  body?: unknown,
  options?: RequestOptions,
): RequestOptions {
  const opts: RequestOptions = { ...options, method };
  if (body !== undefined && body !== null) {
    opts.body = JSON.stringify(body);
  }
  return opts;
}

export const api = {
  get: <T>(endpoint: string, options?: RequestOptions): Promise<T> =>
    apiRequest<T>(endpoint, buildOptions('GET', undefined, options)),

  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> =>
    apiRequest<T>(endpoint, buildOptions('POST', body, options)),

  put: <T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> =>
    apiRequest<T>(endpoint, buildOptions('PUT', body, options)),

  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> =>
    apiRequest<T>(endpoint, buildOptions('PATCH', body, options)),

  delete: <T>(endpoint: string, options?: RequestOptions): Promise<T> =>
    apiRequest<T>(endpoint, buildOptions('DELETE', undefined, options)),
};
