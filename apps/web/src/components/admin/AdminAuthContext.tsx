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
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

const TOKEN_KEY = 'ns_admin_token';
const ROLE_KEY = 'ns_admin_role';
const EMAIL_KEY = 'ns_admin_email';

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ token: null, role: null, email: null });
  const router = useRouter();

  // Restore from sessionStorage on mount
  useEffect(() => {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const role = sessionStorage.getItem(ROLE_KEY);
    const email = sessionStorage.getItem(EMAIL_KEY);
    if (token) setState({ token, role, email });
  }, []);

  const login = useCallback(async (email: string, password: string, totp: string) => {
    const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
    const res = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, totpCode: totp }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { message?: string };
      throw new Error(body.message ?? 'Login failed');
    }
    const data = await res.json() as { accessToken: string; role: string };
    sessionStorage.setItem(TOKEN_KEY, data.accessToken);
    sessionStorage.setItem(ROLE_KEY, data.role);
    sessionStorage.setItem(EMAIL_KEY, email);
    setState({ token: data.accessToken, role: data.role, email });
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(ROLE_KEY);
    sessionStorage.removeItem(EMAIL_KEY);
    setState({ token: null, role: null, email: null });
    router.push('/admin/login');
  }, [router]);

  return (
    <AdminAuthContext.Provider value={{ ...state, login, logout, isAuthenticated: !!state.token }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  return ctx;
}
