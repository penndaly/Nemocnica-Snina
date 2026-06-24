/**
 * Minimal HTTP helpers shared by the OAuth2 platform adapters (global fetch,
 * Node 20+). Token bodies are never logged. Non-2xx responses throw with the
 * status attached so callers can mark the device sync_status='error'.
 */

export interface HttpError extends Error {
  status?: number;
}

async function parse<T>(res: Response, url: string): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} from ${url}`) as HttpError;
    err.status = res.status;
    throw err;
  }
  return (text ? JSON.parse(text) : {}) as T;
}

/** POST application/x-www-form-urlencoded (OAuth token/refresh/revoke endpoints). */
export async function postForm<T = unknown>(
  url: string,
  form: Record<string, string>,
  headers: Record<string, string> = {},
): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
    body: new URLSearchParams(form).toString(),
  });
  return parse<T>(res, url);
}

/** GET JSON with a Bearer token. */
export async function getJson<T = unknown>(
  url: string,
  accessToken: string,
  headers: Record<string, string> = {},
): Promise<T> {
  const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}`, ...headers } });
  return parse<T>(res, url);
}

/** HTTP Basic auth header value for client credentials (Fitbit, Dexcom, …). */
export function basicAuth(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
}
