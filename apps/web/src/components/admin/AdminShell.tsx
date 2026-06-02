'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AdminSidebar } from './AdminSidebar';
import { AdminToast } from './AdminToast';
import { useAdminAuth } from './AdminAuthContext';
import { cloneSeed } from './admin-store';
import type { Seed } from '@ns/types';

interface AdminDataContextValue {
  data: Seed;
  updateCollection: (key: string, items: unknown[]) => void;
  updateSingleton: (key: string, value: unknown) => void;
}

const AdminDataContext = createContext<AdminDataContextValue | null>(null);

export function useAdminData(): AdminDataContextValue {
  const ctx = useContext(AdminDataContext);
  if (!ctx) throw new Error('useAdminData must be inside AdminShell');
  return ctx;
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [data, setData] = useState<Seed>(cloneSeed);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated && pathname !== '/admin/login') {
      router.replace('/admin/login');
    }
  }, [isAuthenticated, pathname, router]);

  const updateCollection = (key: string, items: unknown[]) => {
    setData((prev) => ({ ...prev, [key]: items }));
  };

  const updateSingleton = (key: string, value: unknown) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  if (!isAuthenticated) return null;

  return (
    <AdminDataContext.Provider value={{ data, updateCollection, updateSingleton }}>
      <div style={{ display: 'flex', minHeight: '100vh', background: '#131e2b' }}>
        <AdminSidebar data={data} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <main
            id="admin-main"
            style={{ flex: 1, padding: '2rem', color: '#e8f0fb', maxWidth: 1100 }}
          >
            {children}
          </main>
        </div>
        <AdminToast />
      </div>
    </AdminDataContext.Provider>
  );
}
