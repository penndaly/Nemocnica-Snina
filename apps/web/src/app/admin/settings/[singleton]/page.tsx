'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Save, Loader2 } from 'lucide-react';
import { AdminAuthProvider } from '@/components/admin/AdminAuthContext';
import { AdminShell, useAdminData } from '@/components/admin/AdminShell';
import { SchemaField } from '@/components/admin/SchemaField';
import { showToast } from '@/components/admin/AdminToast';
import { SINGLETONS } from '@/components/admin/admin-schemas';
import type { Seed } from '@ns/types';

function SingletonEditor() {
  const params = useParams();
  const key = String(params['singleton'] ?? '');
  const { data, updateSingleton } = useAdminData();

  const schema = SINGLETONS[key];
  if (!schema) return <p style={{ color: 'rgba(255,255,255,.5)' }}>Unknown singleton: {key}</p>;

  if (schema.groups) {
    // Pages-style grouped singleton
    return <GroupedSingletonEditor singletonKey={key} schema={schema} data={data} updateSingleton={updateSingleton} />;
  }

  // Flat singleton (hospital)
  return <FlatSingletonEditor singletonKey={key} schema={schema} data={data} updateSingleton={updateSingleton} />;
}

function FlatSingletonEditor({
  singletonKey,
  schema,
  data,
  updateSingleton,
}: {
  singletonKey: string;
  schema: typeof SINGLETONS[string];
  data: Seed;
  updateSingleton: (key: string, value: unknown) => void;
}) {
  const current = (data[singletonKey as keyof Seed] ?? {}) as unknown as Record<string, unknown>;
  const [values, setValues] = useState<Record<string, unknown>>({ ...current });
  const [saving, setSaving] = useState(false);

  function handleChange(k: string, v: unknown) { setValues((prev) => ({ ...prev, [k]: v })); }

  function handleSave() {
    setSaving(true);
    updateSingleton(singletonKey, values);
    showToast('Uložené.');
    setSaving(false);
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ fontFamily: 'Newsreader, serif', color: '#fff', fontSize: '1.7rem', marginBottom: '1.5rem' }}>
        {schema.label.sk}
      </h1>
      <div style={{ background: '#1a2533', borderRadius: 12, border: '1px solid rgba(255,255,255,.07)', padding: '1.75rem', marginBottom: '1rem' }}>
        {(schema.fields ?? []).map((field) => (
          <SchemaField key={field.k} field={field} value={values[field.k]} onChange={handleChange} data={data} />
        ))}
      </div>
      <SaveButton saving={saving} onClick={handleSave} />
    </div>
  );
}

function GroupedSingletonEditor({
  singletonKey,
  schema,
  data,
  updateSingleton,
}: {
  singletonKey: string;
  schema: typeof SINGLETONS[string];
  data: Seed;
  updateSingleton: (key: string, value: unknown) => void;
}) {
  const current = (data[singletonKey as keyof Seed] ?? {}) as unknown as Record<string, Record<string, unknown>>;
  const [values, setValues] = useState<Record<string, Record<string, unknown>>>(JSON.parse(JSON.stringify(current)));
  const [saving, setSaving] = useState(false);

  function handleChange(groupPath: string, k: string, v: unknown) {
    setValues((prev) => ({ ...prev, [groupPath]: { ...(prev[groupPath] ?? {}), [k]: v } }));
  }

  function handleSave() {
    setSaving(true);
    updateSingleton(singletonKey, values);
    showToast('Uložené.');
    setSaving(false);
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ fontFamily: 'Newsreader, serif', color: '#fff', fontSize: '1.7rem', marginBottom: '1.5rem' }}>
        {schema.label.sk}
      </h1>
      {(schema.groups ?? []).map((group) => (
        <div key={group.path} style={{ background: '#1a2533', borderRadius: 12, border: '1px solid rgba(255,255,255,.07)', padding: '1.5rem', marginBottom: '1.2rem' }}>
          <h2 style={{ fontFamily: 'Newsreader, serif', color: '#fff', fontSize: '1.15rem', marginBottom: '1.25rem', paddingBottom: '.75rem', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
            {group.title.sk}
          </h2>
          {group.fields.map((field) => (
            <SchemaField
              key={field.k}
              field={field}
              value={(values[group.path] ?? {})[field.k]}
              onChange={(k, v) => handleChange(group.path, k, v)}
              data={data}
            />
          ))}
        </div>
      ))}
      <SaveButton saving={saving} onClick={handleSave} />
    </div>
  );
}

function SaveButton({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      style={{
        display: 'flex', alignItems: 'center', gap: '.5rem',
        background: saving ? 'rgba(30,82,144,.5)' : 'var(--blue-700,#1e5290)',
        color: '#fff', border: 'none', borderRadius: 9,
        padding: '.75em 1.6em', fontFamily: 'Mulish, sans-serif',
        fontWeight: 700, fontSize: '1rem', cursor: saving ? 'not-allowed' : 'pointer',
      }}
    >
      {saving ? <Loader2 size={16} /> : <Save size={16} />}
      Uložiť
    </button>
  );
}

export default function Page() {
  return (
    <AdminAuthProvider>
      <AdminShell>
        <SingletonEditor />
      </AdminShell>
    </AdminAuthProvider>
  );
}
