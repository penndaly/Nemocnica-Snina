'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { SiteLayout } from '@/components/layout/SiteLayout';
import { FileCheck, AlertTriangle, ExternalLink } from 'lucide-react';
import type { SupportedLocale } from '@/i18n/config';

const CONTENT = {
  sk: {
    title: 'Podpis digitálnej kapitačnej dohody',
    intro: 'Vaša žiadosť o registráciu bola schválená. Pre dokončenie procesu je potrebné podpísať kapitačnú dohodu prostredníctvom vašej elektronickej identity (eID).',
    steps: [
      'Prihláste sa na portál Slovensko.sk pomocou vášho eID (občiansky preukaz s čipom alebo mobilná aplikácia).',
      'V sekcii „Zdravotníctvo" vyhľadajte formulár „Kapitačná dohoda – zmena lekára".',
      'Vyplňte a podpíšte dohodu elektronickým podpisom.',
      'Po podpísaní budete obratom informovaný/á o zaradení do zoznamu pacientov zvoleného lekára.',
    ],
    linkLabel: 'Prejsť na Slovensko.sk',
    linkUrl: 'https://www.slovensko.sk',
    note: 'Ak ste dostali tento odkaz e-mailom alebo SMS, je platný 30 dní od dátumu schválenia žiadosti. V prípade otázok kontaktujte recepciu nemocnice.',
    tokenMissing: 'Neplatný alebo chýbajúci token. Skontrolujte odkaz z SMS alebo e-mailu.',
    contact: 'Recepcia: +421 57 766 01 11',
  },
  en: {
    title: 'Sign Digital Capitation Agreement',
    intro: 'Your registration request has been approved. To complete the process, you need to sign the capitation agreement using your electronic identity (eID).',
    steps: [
      'Log in to the Slovensko.sk portal using your eID (identity card with chip or mobile app).',
      'In the "Healthcare" section, find the form "Capitation agreement – change of doctor".',
      'Fill in and sign the agreement with an electronic signature.',
      'After signing, you will be notified of your inclusion in the selected doctor\'s patient list.',
    ],
    linkLabel: 'Go to Slovensko.sk',
    linkUrl: 'https://www.slovensko.sk',
    note: 'If you received this link by SMS or email, it is valid for 30 days from the approval date. For questions, contact the hospital reception.',
    tokenMissing: 'Invalid or missing token. Please check the link from your SMS or email.',
    contact: 'Reception: +421 57 766 01 11',
  },
} as const;

function PodpisContent() {
  const locale = useLocale() as SupportedLocale;
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const c = (locale === 'en' ? CONTENT.en : CONTENT.sk);

  return (
    <SiteLayout locale={locale}>
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '3rem 1.5rem' }}>
        {!token ? (
          <div style={{ display: 'flex', gap: '1rem', background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.3)', borderRadius: 12, padding: '1.5rem' }}>
            <AlertTriangle style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} size={22} />
            <div>
              <p style={{ margin: 0, color: '#ef4444', fontWeight: 600 }}>{c.tokenMissing}</p>
              <p style={{ margin: '.5rem 0 0', color: 'rgba(0,0,0,.5)', fontSize: '.9rem' }}>{c.contact}</p>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(37,99,168,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FileCheck size={26} color="var(--blue-700,#1e5290)" />
              </div>
              <div>
                <h1 style={{ margin: 0, fontFamily: 'Newsreader, Georgia, serif', fontSize: '1.75rem', color: '#0f1923', lineHeight: 1.15 }}>
                  {c.title}
                </h1>
              </div>
            </div>

            <p style={{ color: '#374151', lineHeight: 1.7, marginBottom: '2rem' }}>
              {c.intro}
            </p>

            <ol style={{ margin: '0 0 2rem', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '.85rem' }}>
              {c.steps.map((step, i) => (
                <li key={i} style={{ color: '#374151', lineHeight: 1.65 }}>
                  {step}
                </li>
              ))}
            </ol>

            <a
              href={c.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '.5rem',
                background: 'var(--blue-700,#1e5290)', color: '#fff', borderRadius: 10,
                padding: '.75em 1.5em', fontFamily: 'Mulish, sans-serif', fontWeight: 700,
                textDecoration: 'none', fontSize: '1rem', marginBottom: '2rem',
              }}
            >
              {c.linkLabel}
              <ExternalLink size={16} />
            </a>

            <p style={{ color: 'rgba(0,0,0,.45)', fontSize: '.85rem', lineHeight: 1.65, borderTop: '1px solid rgba(0,0,0,.08)', paddingTop: '1.5rem' }}>
              {c.note}
            </p>
          </>
        )}
      </main>
    </SiteLayout>
  );
}

export default function PodpisPage() {
  return (
    <Suspense fallback={null}>
      <PodpisContent />
    </Suspense>
  );
}
