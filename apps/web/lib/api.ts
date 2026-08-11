export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3005/api';

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: 'CUSTOMER' | 'VENDOR' | 'ADMIN';
  status: string;
};

export type Session = {
  accessToken: string;
  user: SessionUser;
};

const LEGACY_SESSION_KEY = 'intern-commerce-session';
let activeSession: Session | null = null;
let sessionVersion = 0;
let refreshRequest: Promise<Session> | null = null;
const sessionListeners = new Set<(session: Session | null) => void>();

export function getSession(): Session | null {
  removeLegacyPersistedSession();
  return activeSession;
}

export function saveSession(session: Session) {
  activeSession = session;
  sessionVersion += 1;
  removeLegacyPersistedSession();
  notifySessionListeners();
}

export function clearSession() {
  activeSession = null;
  sessionVersion += 1;
  removeLegacyPersistedSession();
  notifySessionListeners();
}

export function subscribeSession(listener: (session: Session | null) => void) {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

export async function restoreSession() {
  if (activeSession) return activeSession;
  try {
    return await refreshSession();
  } catch {
    return null;
  }
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

  let canRefreshAfterResponse = canRefresh;
  if (requireAuth) {
    let session = getSession();
    if (!session) {
      if (!canRefresh) throw new Error('Please sign in to continue');
      session = await refreshSession();
      canRefreshAfterResponse = false;
    }
    headers.set('Authorization', `Bearer ${session.accessToken}`);
  }

  const response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include' });
  if (response.status === 401 && requireAuth && canRefreshAfterResponse) {
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
    const versionAtStart = sessionVersion;
    refreshRequest = fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Your session has expired. Please sign in again.');
        const session = (await response.json()) as Session;
        if (sessionVersion !== versionAtStart) {
          throw new Error('Session changed while refresh was in progress. Please retry.');
        }
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

function removeLegacyPersistedSession() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(LEGACY_SESSION_KEY);
  } catch {
    // Storage may be unavailable under strict browser privacy settings.
  }
}

function notifySessionListeners() {
  for (const listener of sessionListeners) listener(activeSession);
}

export function formatVnd(value: string | number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(value));
}
