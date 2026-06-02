'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AdminAuthProvider } from '@/components/admin/AdminAuthContext';

function AdminRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/admin/departments'); }, [router]);
  return null;
}

export default function AdminRootPage() {
  return (
    <AdminAuthProvider>
      <AdminRedirect />
    </AdminAuthProvider>
  );
}
