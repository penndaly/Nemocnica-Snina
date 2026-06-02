'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { SchemaField } from './SchemaField';
import { showToast } from './AdminToast';
import { slugify, blankItem } from './admin-store';
import { useAdminData } from './AdminShell';
import type { CollectionSchema } from './admin-schemas';
import type { Seed } from '@ns/types';

interface ItemEditorProps {
  collKey: string;
  schema: CollectionSchema;
  existingItem?: Record<string, unknown>;
  isNew: boolean;
}

export function ItemEditor({ collKey, schema, existingItem, isNew }: ItemEditorProps) {
  const router = useRouter();
  const { data, updateCollection } = useAdminData();
  const [item, setItem] = useState<Record<string, unknown>>(
    existingItem ?? blankItem(schema.fields),
  );
  const [saving, setSaving] = useState(false);

  function handleChange(key: string, value: unknown) {
    setItem((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    setSaving(true);
    try {
      const saved = { ...item };

      // Auto-generate ID for new items if not editable
      if (isNew && !schema.idEditable) {
        const baseField = item[schema.idFrom ?? 'name'];
        const baseSk =
          typeof baseField === 'object' && baseField !== null
            ? (baseField as Record<string, string>)['sk'] ?? ''
            : String(baseField ?? '');
        let id = slugify(baseSk);
        const existing = ((data[collKey as keyof Seed] as unknown[]) ?? []).map(
          (x) => (x as Record<string, unknown>)['id'],
        );
        let n = 2;
        let unique = id;
        while (existing.includes(unique)) unique = `${id}-${n++}`;
        saved['id'] = unique;
      } else if (!saved['id']) {
        saved['id'] = `item-${Date.now()}`;
      }

      const current = ((data[collKey as keyof Seed] as unknown[]) ?? []) as Array<Record<string, unknown>>;
      if (isNew) {
        updateCollection(collKey, [...current, saved]);
      } else {
        updateCollection(
          collKey,
          current.map((x) => (x['id'] === saved['id'] ? saved : x)),
        );
      }

      showToast('Uložené.');
      router.push(`/admin/${collKey}`);
    } catch {
      showToast('Chyba pri ukladaní.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Back + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <Link
          href={`/admin/${collKey}`}
          style={{
            display: 'flex', alignItems: 'center', gap: '.4rem',
            color: 'rgba(255,255,255,.5)', textDecoration: 'none', fontSize: '.88rem',
          }}
        >
          <ArrowLeft size={16} />
          {schema.label.sk}
        </Link>
        <span style={{ color: 'rgba(255,255,255,.2)' }}>/</span>
        <h1 style={{ fontFamily: 'Newsreader, serif', color: '#fff', margin: 0, fontSize: '1.5rem' }}>
          {isNew ? 'Nová položka' : 'Upraviť'}
        </h1>
      </div>

      {/* Editor card */}
      <div
        style={{
          background: '#1a2533',
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,.07)',
          padding: '1.75rem',
        }}
      >
        {schema.fields.map((field) => (
          <SchemaField
            key={field.k}
            field={field}
            value={item[field.k]}
            onChange={handleChange}
            data={data}
          />
        ))}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '.75rem', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,.07)' }}>
          <button
            onClick={handleSave}
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
          <Link
            href={`/admin/${collKey}`}
            style={{
              display: 'flex', alignItems: 'center', gap: '.5rem',
              background: 'rgba(255,255,255,.07)', color: 'rgba(255,255,255,.7)',
              border: '1px solid rgba(255,255,255,.12)', borderRadius: 9,
              padding: '.75em 1.6em', fontFamily: 'Mulish, sans-serif',
              fontWeight: 700, fontSize: '1rem', textDecoration: 'none',
            }}
          >
            Zrušiť
          </Link>
        </div>
      </div>
    </div>
  );
}
