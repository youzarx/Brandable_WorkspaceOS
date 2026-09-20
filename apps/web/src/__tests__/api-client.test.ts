import { describe, it, expect, beforeEach, vi } from 'vitest';
import { api, setInMemoryAccessToken, getInMemoryAccessToken, ApiError } from '../lib/api';

describe('API Client & Memory Token Management', () => {
  beforeEach(() => {
    setInMemoryAccessToken(null);
    vi.restoreAllMocks();
  });

  it('manages short-lived access token in JS memory only', () => {
    expect(getInMemoryAccessToken()).toBeNull();
    setInMemoryAccessToken('sample-access-token-123');
    expect(getInMemoryAccessToken()).toBe('sample-access-token-123');
  });

  it('executes GET request with envelope parsing and token header', async () => {
    setInMemoryAccessToken('valid-token');

    const mockResponseData = { id: 'usr-1', email: 'test@example.com' };
    const globalFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true, data: mockResponseData }),
    });
    vi.stubGlobal('fetch', globalFetch);

    const result = await api.get<{ id: string; email: string }>('/auth/me');

    expect(result).toEqual(mockResponseData);
    expect(globalFetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/me'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer valid-token',
        }),
        credentials: 'include',
      }),
    );
  });

  it('handles API error responses correctly', async () => {
    const globalFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () =>
        JSON.stringify({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        }),
    });
    vi.stubGlobal('fetch', globalFetch);

    await expect(api.get('/protected-route', { skipRetry: true })).rejects.toThrow(ApiError);
  });
});
