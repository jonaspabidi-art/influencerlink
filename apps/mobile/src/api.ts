import Constants from 'expo-constants';
import { DemoError, handleDemoRequest } from './demo/backend';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function resolveBaseUrl(): string | null {
  // Sätts vid bygget (t.ex. i Netlify eller Vercel) och pekar på det riktiga API:et.
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv.replace(/\/$/, '');

  const configured = Constants.expoConfig?.extra?.apiUrl;
  if (typeof configured === 'string' && configured.length > 0) return configured.replace(/\/$/, '');

  return null;
}

export const API_BASE_URL = resolveBaseUrl();

/**
 * Utan konfigurerad API-adress kör appen mot en inbyggd demobackend. Då går
 * hela flödet att klicka igenom utan server, databas, BankID eller Stripe.
 */
export const DEMO_MODE = API_BASE_URL === null;

let accessToken: string | null = null;
let onUnauthorized: (() => void) | undefined;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/** Anropas när servern svarar 401, så att appen kan skicka tillbaka till login. */
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (DEMO_MODE) {
    try {
      return (await handleDemoRequest(options.method ?? 'GET', path, options.body, accessToken)) as T;
    } catch (error) {
      if (error instanceof DemoError) {
        if (error.status === 401) onUnauthorized?.();
        throw new ApiError(error.status, error.code, error.message);
      }
      throw error;
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : undefined;

  if (!response.ok) {
    if (response.status === 401) onUnauthorized?.();
    const problem = payload as { error?: string; message?: string; details?: unknown } | undefined;
    throw new ApiError(
      response.status,
      problem?.error ?? 'unknown',
      problem?.message ?? 'Något gick fel. Försök igen.',
      problem?.details,
    );
  }

  return payload as T;
}

/** Kortare skrivsätt för de vanligaste anropen. */
export const api = {
  get: <T>(path: string, signal?: AbortSignal) => apiRequest<T>(path, { signal }),
  post: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PATCH', body }),
  del: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
};
