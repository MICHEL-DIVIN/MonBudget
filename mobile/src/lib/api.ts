import * as SecureStore from 'expo-secure-store';
import { API_URL } from './config';

const ACCESS_KEY = 'mb.access';
const REFRESH_KEY = 'mb.refresh';
const TIMEOUT_MS = 20_000;

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
  /** Pas de réponse du serveur (hors ligne, timeout, serveur injoignable). */
  get isNetwork() {
    return this.status === 0;
  }
}

interface Tokens {
  access: string;
  refresh: string;
}

let tokens: Tokens | null = null;
let onSessionExpired: (() => void) | null = null;
let refreshing: Promise<boolean> | null = null;

export function setSessionExpiredHandler(fn: () => void) {
  onSessionExpired = fn;
}

export async function loadTokens(): Promise<boolean> {
  const [access, refresh] = await Promise.all([SecureStore.getItemAsync(ACCESS_KEY), SecureStore.getItemAsync(REFRESH_KEY)]);
  tokens = access && refresh ? { access, refresh } : null;
  return tokens !== null;
}

export async function setTokens(next: Tokens | null): Promise<void> {
  tokens = next;
  if (next) {
    await Promise.all([SecureStore.setItemAsync(ACCESS_KEY, next.access), SecureStore.setItemAsync(REFRESH_KEY, next.refresh)]);
  } else {
    await Promise.all([SecureStore.deleteItemAsync(ACCESS_KEY), SecureStore.deleteItemAsync(REFRESH_KEY)]);
  }
}

export const getRefreshToken = () => tokens?.refresh ?? null;
export const hasTokens = () => tokens !== null;

async function rawFetch(method: string, path: string, body: unknown, auth: boolean): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(API_URL + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(auth && tokens ? { Authorization: `Bearer ${tokens.access}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError('Serveur injoignable', 0);
  } finally {
    clearTimeout(timer);
  }
}

function messageOf(json: unknown, fallback: string): string {
  const m = (json as { message?: string | string[] } | null)?.message;
  return Array.isArray(m) ? m.join('\n') : (m ?? fallback);
}

/** Renouvelle l'access token. Un seul renouvellement à la fois, même si plusieurs requêtes échouent en parallèle. */
async function refreshTokens(): Promise<boolean> {
  if (!tokens) return false;
  refreshing ??= (async () => {
    try {
      const res = await rawFetch('POST', '/auth/refresh', { refresh_token: tokens!.refresh }, false);
      if (res.status === 401 || res.status === 400) {
        await setTokens(null);
        onSessionExpired?.();
        return false;
      }
      if (!res.ok) return false;
      const json = (await res.json()) as { access_token: string; refresh_token: string };
      await setTokens({ access: json.access_token, refresh: json.refresh_token });
      return true;
    } catch {
      return false; // réseau : on garde la session, on réessaiera
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function request<T>(method: string, path: string, body?: unknown, opts: { auth?: boolean } = {}): Promise<T> {
  const auth = opts.auth ?? true;
  let res = await rawFetch(method, path, body, auth);

  if (res.status === 401 && auth && tokens) {
    if (await refreshTokens()) res = await rawFetch(method, path, body, auth);
  }

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* corps non JSON */
  }
  if (!res.ok) throw new ApiError(messageOf(json, `Erreur ${res.status}`), res.status);
  return json as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown, opts?: { auth?: boolean }) => request<T>('POST', path, body ?? {}, opts),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body ?? {}),
};
