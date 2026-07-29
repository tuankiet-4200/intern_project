export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3005/api';

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: 'CUSTOMER' | 'VENDOR' | 'ADMIN';
  status: string;
};

type Session = {
  accessToken: string;
  user: SessionUser;
};

const SESSION_KEY = 'intern-commerce-session';
let refreshRequest: Promise<Session> | null = null;

export function getSession(): Session | null {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(SESSION_KEY);
  if (!value) return null;
  try {
    return JSON.parse(value) as Session;
  } catch {
    window.localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function saveSession(session: Session) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  window.localStorage.removeItem(SESSION_KEY);
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, requireAuth = false): Promise<T> {
  return requestWithRefresh<T>(path, init, requireAuth, true);
}

async function requestWithRefresh<T>(
  path: string,
  init: RequestInit,
  requireAuth: boolean,
  canRefresh: boolean,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  if (requireAuth) {
    const session = getSession();
    if (!session) throw new Error('Please sign in to continue');
    headers.set('Authorization', `Bearer ${session.accessToken}`);
  }

  const response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include' });
  if (response.status === 401 && requireAuth && canRefresh) {
    await refreshSession();
    return requestWithRefresh<T>(path, init, requireAuth, false);
  }

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as T & { message?: string | string[] }) : null;
  if (!response.ok) {
    const message = Array.isArray(payload?.message) ? payload.message.join(', ') : payload?.message;
    throw new Error(message ?? `Request failed with status ${response.status}`);
  }
  return payload as T;
}

async function refreshSession() {
  if (!refreshRequest) {
    refreshRequest = fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Your session has expired. Please sign in again.');
        const session = (await response.json()) as Session;
        saveSession(session);
        return session;
      })
      .catch((error) => {
        clearSession();
        throw error;
      })
      .finally(() => {
        refreshRequest = null;
      });
  }
  return refreshRequest;
}

export function formatVnd(value: string | number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(value));
}
