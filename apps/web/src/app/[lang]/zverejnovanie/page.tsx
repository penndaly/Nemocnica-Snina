'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Download, Search } from 'lucide-react';
import { SiteLayout } from '@/components/layout/SiteLayout';
import { SEED } from '@/lib/seed';
import { localizeField } from '@/lib/i18n-utils';
import type { SupportedLocale } from '@/i18n/config';

type Filter = 'all' | 'contract' | 'invoice';

export default function DisclosuresPage() {
  const t = useTranslations();
  const locale = useLocale() as SupportedLocale;
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = SEED.disclosures.filter((d) => {
    const type = localizeField(d.type, locale).toLowerCase();
    const matchesFilter =
      filter === 'all' ||
      (filter === 'contract' && (type.includes('zmluva') || type.includes('contract'))) ||
      (filter === 'invoice' && (type.includes('faktúra') || type.includes('invoice')));
    const matchesQuery =
      !query ||
      d.partner.toLowerCase().includes(query.toLowerCase()) ||
      d.id.toLowerCase().includes(query.toLowerCase());
    return matchesFilter && matchesQuery;
  });

  return (
    <SiteLayout activePath={`/${locale}/zverejnovanie`}>
      <div style={{ padding: '2.5rem 0 4rem' }}>
        <div className="container">
          <p className="eyebrow">{t('footer.legal')}</p>
          <h1 style={{ marginBottom: '1.5rem' }}>
            {locale === 'sk' ? 'Zverejňovanie zmlúv a faktúr' : 'Contracts & invoices'}
          </h1>

          {/* Toolbar */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 260px' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }} aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={locale === 'sk' ? 'Hľadať...' : 'Search...'}
                style={{ paddingLeft: '2.2rem', width: '100%' }}
                aria-label={locale === 'sk' ? 'Hľadať v zverejneniach' : 'Search disclosures'}
              />
            </div>
            <div role="group" aria-label={locale === 'sk' ? 'Filter typu' : 'Type filter'} style={{ display: 'flex', gap: '.4rem' }}>
              {(['all', 'contract', 'invoice'] as Filter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  aria-pressed={filter === f}
                  className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
                >
                  {{ all: locale === 'sk' ? 'Všetky' : 'All', contract: locale === 'sk' ? 'Zmluvy' : 'Contracts', invoice: locale === 'sk' ? 'Faktúry' : 'Invoices' }[f]}
                </button>
              ))}
            </div>
          </div>

          <div className="card" style={{ overflowX: 'auto' }}>
            <table className="data" aria-label={locale === 'sk' ? 'Zverejnené dokumenty' : 'Published documents'}>
              <thead>
                <tr>
                  <th>{locale === 'sk' ? 'Číslo' : 'ID'}</th>
                  <th>{locale === 'sk' ? 'Typ' : 'Type'}</th>
                  <th>{locale === 'sk' ? 'Partner / Predmet' : 'Partner / Subject'}</th>
                  <th>{locale === 'sk' ? 'Hodnota' : 'Value'}</th>
                  <th>{locale === 'sk' ? 'Dátum' : 'Date'}</th>
                  <th>{locale === 'sk' ? 'PDF' : 'PDF'}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const isContract = localizeField(d.type, locale).toLowerCase().includes('zmluva') || localizeField(d.type, locale).toLowerCase().includes('contract');
                  return (
                    <tr key={d.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '.82rem' }}>{d.id}</td>
                      <td>
                        <span className={`badge ${isContract ? 'badge-blue' : 'badge-terra'}`}>
                          {localizeField(d.type, locale)}
                        </span>
                      </td>
                      <td style={{ maxWidth: 300 }}>{d.partner}</td>
                      <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{d.value}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {new Date(d.date).toLocaleDateString(locale === 'sk' ? 'sk-SK' : 'en-GB')}
                      </td>
                      <td>
                        {d.pdfUrl ? (
                          <a
                            href={d.pdfUrl}
                            download
                            className="btn btn-ghost btn-sm"
                            aria-label={`${locale === 'sk' ? 'Stiahnuť' : 'Download'} ${d.id}`}
                          >
                            <Download size={14} aria-hidden />
                            PDF
                          </a>
                        ) : (
                          <span style={{ color: 'var(--ink-3)', fontSize: '.82rem' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--ink-3)', padding: '2rem' }}>
                      {locale === 'sk' ? 'Žiadne záznamy.' : 'No records found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
