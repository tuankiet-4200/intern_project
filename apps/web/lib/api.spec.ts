import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { apiRequest, clearSession, getSession, saveSession, type Session } from './api';

const localStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};
const fetchMock = jest.fn<typeof fetch>();

Object.defineProperty(globalThis, 'window', { value: { localStorage }, configurable: true });
Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true, writable: true });

describe('browser session hardening', () => {
  const session: Session = {
    accessToken: 'access-token',
    user: {
      id: 'user-1', email: 'user@example.com', fullName: 'User', role: 'CUSTOMER', status: 'ACTIVE',
    },
  };

  beforeEach(() => {
    fetchMock.mockReset();
    localStorage.getItem.mockClear();
    localStorage.setItem.mockClear();
    localStorage.removeItem.mockClear();
    clearSession();
  });

  it('keeps the access token in memory and removes legacy local-storage data', () => {
    saveSession(session);

    expect(getSession()).toEqual(session);
    expect(localStorage.setItem).not.toHaveBeenCalled();
    expect(localStorage.removeItem).toHaveBeenCalledWith('intern-commerce-session');
  });

  it('restores an in-memory session from the HttpOnly-cookie refresh flow after reload', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(session))
      .mockResolvedValueOnce(textResponse({ id: 'user-1' }));

    await expect(apiRequest<{ id: string }>('/users/me', {}, true)).resolves.toEqual({ id: 'user-1' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/auth/refresh');
    const protectedHeaders = new Headers(fetchMock.mock.calls[1][1]?.headers);
    expect(protectedHeaders.get('Authorization')).toBe('Bearer access-token');
    expect(getSession()).toEqual(session);
  });

  it('deduplicates concurrent refresh attempts when memory is empty', async () => {
    let resolveRefresh!: (response: Response) => void;
    fetchMock.mockImplementation((input) => {
      if (String(input).includes('/auth/refresh')) {
        return new Promise<Response>((resolve) => { resolveRefresh = resolve; });
      }
      return Promise.resolve(textResponse({ ok: true }));
    });

    const first = apiRequest('/orders', {}, true);
    const second = apiRequest('/cart', {}, true);
    resolveRefresh(jsonResponse(session));
    await Promise.all([first, second]);

    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes('/auth/refresh'))).toHaveLength(1);
  });

  it('does not restore a stale refresh response after the session is cleared', async () => {
    let resolveRefresh!: (response: Response) => void;
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => { resolveRefresh = resolve; }));

    const request = apiRequest('/orders', {}, true);
    clearSession();
    resolveRefresh(jsonResponse(session));

    await expect(request).rejects.toThrow('Session changed while refresh was in progress');
    expect(getSession()).toBeNull();
  });
});

function jsonResponse(payload: unknown) {
  return { ok: true, status: 200, json: async () => payload } as Response;
}

function textResponse(payload: unknown) {
  return { ok: true, status: 200, text: async () => JSON.stringify(payload) } as Response;
}
