'use client';

/**
 * Shared authed fetch for admin pages (Sprint: Production Admin Portal).
 *
 * Every admin page previously inlined `fetch(API, { Authorization: Bearer })`.
 * This centralises the staff-JWT header, error unwrapping and CSV download so
 * new sections stay small. Server-side guards (StaffJwtGuard/StaffRolesGuard/
 * ScopeGuard) remain the real gate — anything here is cosmetic.
 */
import { useCallback, useMemo } from 'react';
import { useAdminAuth } from './AdminAuthContext';

export const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

/** Error carrying the API's structured `code` so callers can branch on it. */
export class AdminApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
    this.code = code;
  }
}

export function qs(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export interface AdminApi {
  get: <T>(path: string) => Promise<T>;
  post: <T>(path: string, body?: unknown) => Promise<T>;
  put: <T>(path: string, body?: unknown) => Promise<T>;
  del: <T>(path: string) => Promise<T>;
  /** Streams a file response to the browser's downloads (used by CSV export). */
  download: (path: string, filename: string) => Promise<void>;
}

export function useAdminApi(): AdminApi {
  const { token } = useAdminAuth();

  const request = useCallback(
    async <T,>(method: string, path: string, body?: unknown): Promise<T> => {
      const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          message?: string | string[];
          code?: string;
        };
        const msg = Array.isArray(payload.message) ? payload.message.join(', ') : payload.message;
        throw new AdminApiError(res.status, msg ?? `HTTP ${res.status}`, payload.code);
      }
      if (res.status === 204) return undefined as T;
      const text = await res.text();
      return (text ? JSON.parse(text) : undefined) as T;
    },
    [token],
  );

  const download = useCallback(
    async (path: string, filename: string) => {
      const res = await fetch(`${API_BASE}${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new AdminApiError(res.status, `HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    [token],
  );

  return useMemo(
    () => ({
      get: <T,>(p: string) => request<T>('GET', p),
      post: <T,>(p: string, b?: unknown) => request<T>('POST', p, b),
      put: <T,>(p: string, b?: unknown) => request<T>('PUT', p, b),
      del: <T,>(p: string) => request<T>('DELETE', p),
      download,
    }),
    [request, download],
  );
}
