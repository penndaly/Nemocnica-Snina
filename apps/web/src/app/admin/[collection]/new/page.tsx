'use client';

import { useParams } from 'next/navigation';
import { AdminAuthProvider } from '@/components/admin/AdminAuthContext';
import { AdminShell } from '@/components/admin/AdminShell';
import { ItemEditor } from '@/components/admin/ItemEditor';
import { SCHEMAS } from '@/components/admin/admin-schemas';

function NewItemPage() {
  const params = useParams();
  const collKey = String(params['collection'] ?? '');
  const schema = SCHEMAS[collKey];

  if (!schema) {
    return <p style={{ color: 'rgba(255,255,255,.5)' }}>Unknown collection: {collKey}</p>;
  }

  return <ItemEditor collKey={collKey} schema={schema} isNew />;
}

export default function Page() {
  return (
    <AdminAuthProvider>
      <AdminShell>
        <NewItemPage />
      </AdminShell>
    </AdminAuthProvider>
  );
}
