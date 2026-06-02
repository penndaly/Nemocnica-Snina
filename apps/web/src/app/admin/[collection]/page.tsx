'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { AdminAuthProvider } from '@/components/admin/AdminAuthContext';
import { AdminShell, useAdminData } from '@/components/admin/AdminShell';
import { SCHEMAS } from '@/components/admin/admin-schemas';
import { showToast } from '@/components/admin/AdminToast';
import type { Seed } from '@ns/types';

function localeSk(v: unknown): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && 'sk' in (v as object)) return (v as Record<string, string>)['sk'] ?? '';
  return String(v);
}

const STATUS_BADGE: Record<string, { text: string; bg: string; color: string }> = {
  open:   { text: 'V prevádzke', bg: 'var(--green-50,#e6f2ec)',  color: 'var(--green,#2f8a64)' },
  new:    { text: 'Nová',        bg: 'var(--blue-50,#eef4fa)',   color: 'var(--blue-700,#1e5290)' },
  alert:  { text: 'Dočasný',    bg: 'var(--amber-50,#f7efdc)',  color: 'var(--amber,#c08a2e)' },
  closed: { text: 'Zatvorená',  bg: 'var(--warm-100,#f3ece1)',  color: 'var(--ink-2,#5b5347)' },
};

function BadgeFor({ collKey, item }: { collKey: string; item: Record<string, unknown> }) {
  if (collKey === 'clinics') {
    const s = STATUS_BADGE[String(item['status'])] ?? STATUS_BADGE['open']!;
    return (
      <span style={{ background: s.bg, color: s.color, borderRadius: 999, padding: '.2em .7em', fontSize: '.74rem', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
        {s.text}
      </span>
    );
  }
  if (collKey === 'physicians') {
    return item['accepting'] ? (
      <span style={{ background: 'var(--green-50,#e6f2ec)', color: 'var(--green,#2f8a64)', borderRadius: 999, padding: '.2em .7em', fontSize: '.74rem', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
        Prijíma
      </span>
    ) : null;
  }
  if (collKey === 'departments' && item['featured']) {
    return (
      <span style={{ background: 'var(--blue-50,#eef4fa)', color: 'var(--blue-700,#1e5290)', borderRadius: 999, padding: '.2em .7em', fontSize: '.74rem', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
        Úvod
      </span>
    );
  }
  if (collKey === 'news') {
    const typeMap: Record<string, string> = { good: 'var(--green,#2f8a64)', info: 'var(--blue-700,#1e5290)', alert: 'var(--amber,#c08a2e)' };
    const col = typeMap[String(item['type'] ?? '')] ?? 'var(--ink-3)';
    return (
      <span style={{ color: col, borderRadius: 999, padding: '.2em .7em', fontSize: '.74rem', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', border: `1px solid ${col}` }}>
        {localeSk(item['tag'])}
      </span>
    );
  }
  return null;
}

function subtitleFor(key: string, item: Record<string, unknown>): string {
  switch (key) {
    case 'departments': return `${item['lead'] ?? ''} ${item['beds'] ? `· ${item['beds']} lôžok` : ''}`.trim();
    case 'clinics':     return `${item['doctor'] ?? ''} · ${localeSk(item['location'])}`;
    case 'physicians':  return localeSk(item['role']);
    case 'services':    return localeSk(item['desc']).slice(0, 70);
    case 'facilities':  return `${item['lead'] ? item['lead'] + ' · ' : ''}${localeSk(item['kind'])}`;
    case 'news':        return String(item['date'] ?? '');
    case 'disclosures': return `${item['id']} · ${item['date'] ?? ''}`;
    default:            return '';
  }
}

function CollectionList() {
  const params = useParams();
  const router = useRouter();
  const collKey = String(params['collection'] ?? '');
  const { data, updateCollection } = useAdminData();

  const schema = SCHEMAS[collKey];
  if (!schema) return <p style={{ color: 'rgba(255,255,255,.5)' }}>Collection not found: {collKey}</p>;

  const items = (data[collKey as keyof Seed] as unknown[]) ?? [];

  function handleDelete(id: string, name: string) {
    if (!confirm(`Vymazať „${name}"?`)) return;
    const next = (items as Array<{ id: string }>).filter((x) => x.id !== id);
    updateCollection(collKey, next);
    showToast('Vymazané.');
  }

  return (
    <div>
      {/* Head */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: 'Newsreader, serif', color: '#fff', margin: 0, fontSize: '1.7rem' }}>
            {schema.label.sk}
          </h1>
          <p style={{ color: 'rgba(255,255,255,.4)', margin: '.25rem 0 0', fontSize: '.88rem' }}>
            {items.length} položiek · zmeny sa prejavia na webe okamžite
          </p>
        </div>
        <Link
          href={`/admin/${collKey}/new`}
          style={{
            display: 'flex', alignItems: 'center', gap: '.5rem',
            background: 'var(--blue-700,#1e5290)', color: '#fff', border: 'none',
            borderRadius: 9, padding: '.65em 1.2em', fontFamily: 'Mulish, sans-serif',
            fontWeight: 700, fontSize: '.92rem', textDecoration: 'none', whiteSpace: 'nowrap',
          }}
        >
          <Plus size={16} />
          Pridať
        </Link>
      </div>

      {/* Rows */}
      <div
        style={{
          background: '#1a2533',
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,.07)',
          overflow: 'hidden',
        }}
      >
        {items.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255,255,255,.3)' }}>
            Žiadne položky. Kliknutím na „Pridať" vytvoríte prvú.
          </div>
        ) : (
          (items as Array<Record<string, unknown>>).map((item, idx) => {
            const titleRaw = item[schema.title];
            const title = schema.titlePlain ? String(titleRaw ?? '—') : localeSk(titleRaw);
            const sub = subtitleFor(collKey, item);
            const id = String(item['id'] ?? idx);

            return (
              <div
                key={id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '.9rem 1.2rem',
                  borderBottom: '1px solid rgba(255,255,255,.05)',
                  transition: 'background .12s',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: '#e8f0fb', fontSize: '.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {title || '—'}
                  </div>
                  {sub && (
                    <div style={{ fontSize: '.82rem', color: 'rgba(255,255,255,.4)', marginTop: '.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {sub}
                    </div>
                  )}
                </div>
                <BadgeFor collKey={collKey} item={item} />
                <div style={{ display: 'flex', gap: '.4rem', flexShrink: 0 }}>
                  <Link
                    href={`/admin/${collKey}/${id}`}
                    title="Upraviť"
                    aria-label={`Upraviť ${title}`}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 34, height: 34, borderRadius: 7,
                      background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.7)',
                      textDecoration: 'none', border: 'none', cursor: 'pointer',
                      transition: 'background .12s',
                    }}
                  >
                    <Pencil size={15} />
                  </Link>
                  <button
                    onClick={() => handleDelete(id, title)}
                    title="Vymazať"
                    aria-label={`Vymazať ${title}`}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 34, height: 34, borderRadius: 7,
                      background: 'rgba(192,57,43,.15)', color: 'rgba(255,140,130,.8)',
                      border: 'none', cursor: 'pointer',
                      transition: 'background .12s',
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function CollectionPage() {
  return (
    <AdminAuthProvider>
      <AdminShell>
        <CollectionList />
      </AdminShell>
    </AdminAuthProvider>
  );
}
