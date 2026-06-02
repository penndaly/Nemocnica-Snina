'use client';

import { useParams } from 'next/navigation';
import { AdminAuthProvider } from '@/components/admin/AdminAuthContext';
import { AdminShell, useAdminData } from '@/components/admin/AdminShell';
import { ItemEditor } from '@/components/admin/ItemEditor';
import { SCHEMAS } from '@/components/admin/admin-schemas';
import type { Seed } from '@ns/types';

function EditItemPage() {
  const params = useParams();
  const collKey = String(params['collection'] ?? '');
  const id = String(params['id'] ?? '');
  const { data } = useAdminData();

  const schema = SCHEMAS[collKey];
  if (!schema) return <p style={{ color: 'rgba(255,255,255,.5)' }}>Unknown collection.</p>;

  const items = ((data[collKey as keyof Seed] as unknown[]) ?? []) as Array<Record<string, unknown>>;
  const existing = items.find((x) => x['id'] === id);

  if (!existing) {
    return <p style={{ color: 'rgba(255,255,255,.5)' }}>Položka nenájdená: {id}</p>;
  }

  return (
    <ItemEditor
      collKey={collKey}
      schema={schema}
      existingItem={JSON.parse(JSON.stringify(existing)) as Record<string, unknown>}
      isNew={false}
    />
  );
}

export default function Page() {
  return (
    <AdminAuthProvider>
      <AdminShell>
        <EditItemPage />
      </AdminShell>
    </AdminAuthProvider>
  );
}
