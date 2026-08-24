'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface AuthState {
  token: string | null;
  role: string | null;
  email: string | null;
}

interface AdminAuthContextValue extends AuthState {
  login: (email: string, password: string, totp: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  /**
   * True until the sessionStorage restore below has run. Consumers MUST wait
   * for this before acting on `isAuthenticated`: child effects fire before
   * parent effects, so AdminShell's guard would otherwise run one tick before
   * the token is restored and bounce every reload/deep-link to the login page.
   */
  restoring: boolean;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

const TOKEN_KEY = 'ns_admin_token';
const ROLE_KEY = 'ns_admin_role';
const EMAIL_KEY = 'ns_admin_email';

/** Decode the `role` claim from a staff JWT (base64url payload). UI gating only. */
function roleFromJwt(token: string): string {
  try {
    const payload = token.split('.')[1];
    if (!payload) return '';
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return (JSON.parse(json) as { role?: string }).role ?? '';
  } catch {
    return '';
  }
}

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ token: null, role: null, email: null });
  const [restoring, setRestoring] = useState(true);
  const router = useRouter();

  // Restore from sessionStorage on mount
  useEffect(() => {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const role = sessionStorage.getItem(ROLE_KEY);
    const email = sessionStorage.getItem(EMAIL_KEY);
    if (token) setState({ token, role, email });
    setRestoring(false);
  }, []);

  // Staff login is two-step (A2/A3): password → MFA challenge → TOTP → staff JWT
  // (aud=ns.staff, STAFF_JWT_SECRET). Replaces the legacy /api/auth/login so the
  // Super Admin Users UI authenticates with a real staff token in production
  // (no CMS_AUTH_BYPASS). The role is read from the access token's `role` claim.
  const login = useCallback(async (email: string, password: string, totp: string) => {
    const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

    const step1 = await fetch(`${apiUrl}/api/auth/staff/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!step1.ok) {
      const body = await step1.json().catch(() => ({})) as { message?: string };
      throw new Error(body.message ?? 'Login failed');
    }
    const { mfaToken } = await step1.json() as { mfaToken: string };

    const step2 = await fetch(`${apiUrl}/api/auth/staff/verify-mfa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // accept the HttpOnly refresh cookie
      body: JSON.stringify({ mfaToken, totpCode: totp }),
    });
    if (!step2.ok) {
      const body = await step2.json().catch(() => ({})) as { message?: string };
      throw new Error(body.message ?? 'Invalid MFA code');
    }
    const { accessToken } = await step2.json() as { accessToken: string };
    const role = roleFromJwt(accessToken);

    sessionStorage.setItem(TOKEN_KEY, accessToken);
    sessionStorage.setItem(ROLE_KEY, role);
    sessionStorage.setItem(EMAIL_KEY, email);
    setState({ token: accessToken, role, email });
  }, []);

  const logout = useCallback(() => {
    const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (token) {
      // Best-effort server-side revocation (blacklists the jti).
      void fetch(`${apiUrl}/api/auth/staff/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      }).catch(() => {});
    }
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(ROLE_KEY);
    sessionStorage.removeItem(EMAIL_KEY);
    setState({ token: null, role: null, email: null });
    router.push('/admin/login');
  }, [router]);

  return (
    <AdminAuthContext.Provider value={{ ...state, login, logout, isAuthenticated: !!state.token, restoring }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  return ctx;
}
