import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Shield, Lock, Eye, Trash2, FileText } from 'lucide-react';

interface Props {
  params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const t = await getTranslations({ locale: lang, namespace: 'telehealth' });
  const title = t('privacyTitle');
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://nemocnica-snina.sk';
  return {
    title: `${title} — Nemocnica Snina`,
    description:
      lang === 'sk'
        ? 'Informácie o spracúvaní osobných údajov pri využívaní telehealth videokonzultácií v Nemocnici Snina.'
        : 'Information about personal data processing for telehealth video consultations at Nemocnica Snina.',
    alternates: {
      canonical: `${baseUrl}/${lang}/telehealth/sukromie`,
      languages: {
        sk: `${baseUrl}/sk/telehealth/sukromie`,
        en: `${baseUrl}/en/telehealth/sukromie`,
      },
    },
  };
}

export default async function TelehealthPrivacyPage({ params }: Props) {
  const { lang } = await params;
  const isSk = lang === 'sk';

  const sections = isSk ? SK_SECTIONS : EN_SECTIONS;
  const heading = isSk ? 'Ochrana súkromia pri Telehealth' : 'Telehealth Privacy Notice';
  const intro = isSk
    ? 'Tieto informácie vysvetľujú, ako Nemocnica Snina spracúva vaše osobné údaje pri poskytovaní videokonzultácií (Telehealth) v súlade so zákonom č. 18/2018 Z. z. a nariadením GDPR (EÚ) 2016/679.'
    : 'This notice explains how Nemocnica Snina processes your personal data when providing video consultations (Telehealth) in accordance with Act No. 18/2018 Coll. and the GDPR (EU) 2016/679.';
  const lastUpdated = isSk ? 'Posledná aktualizácia: 21. júna 2026' : 'Last updated: 21 June 2026';

  return (
    <main id="main-content" style={{ padding: '3rem 0 5rem' }}>
      <div className="container-narrow">

        {/* Header */}
        <p className="eyebrow">
          {isSk ? 'Telehealth · Ochrana súkromia' : 'Telehealth · Privacy'}
        </p>
        <h1>{heading}</h1>
        <p className="lede" style={{ marginBottom: '.5rem' }}>{intro}</p>
        <p style={{ color: 'var(--ink-3)', fontSize: '.88rem', marginBottom: '3rem' }}>{lastUpdated}</p>

        {/* Summary chips */}
        <div
          style={{
            display: 'flex', flexWrap: 'wrap', gap: '.75rem',
            padding: '1.25rem 1.5rem',
            background: 'var(--blue-50)', borderRadius: 'var(--radius)',
            border: '1px solid var(--blue-100)', marginBottom: '2.5rem',
          }}
        >
          {[
            { icon: <Eye size={16} aria-hidden="true" />, label: isSk ? 'Žiadne nahrávanie' : 'No recording' },
            { icon: <Shield size={16} aria-hidden="true" />, label: isSk ? 'EU servery' : 'EU servers only' },
            { icon: <Lock size={16} aria-hidden="true" />, label: 'TLS 1.3 · AES-256' },
            { icon: <Trash2 size={16} aria-hidden="true" />, label: isSk ? 'Výmaz po 7 dňoch' : 'Purged after 7 days' },
          ].map((item) => (
            <span key={item.label} className="chip">
              {item.icon}
              {item.label}
            </span>
          ))}
        </div>

        {/* Sections */}
        {sections.map((section) => (
          <section key={section.heading} style={{ marginBottom: '2.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', marginBottom: '.75rem' }}>
              {section.icon}
              <h2 style={{ margin: 0, fontSize: '1.35rem' }}>{section.heading}</h2>
            </div>
            {section.paragraphs.map((para, i) => (
              <p key={i} style={{ color: 'var(--ink-2)', lineHeight: 1.7 }}>{para}</p>
            ))}
            {section.bullets && (
              <ul style={{ color: 'var(--ink-2)', lineHeight: 1.7, paddingLeft: '1.25rem', marginTop: '.25rem' }}>
                {section.bullets.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            )}
          </section>
        ))}

        {/* Legal contact box */}
        <div
          style={{
            background: 'var(--warm-100)', borderRadius: 'var(--radius)',
            border: '1px solid var(--line)', padding: '1.5rem 1.75rem', marginTop: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', marginBottom: '.75rem' }}>
            <FileText size={20} aria-hidden="true" style={{ color: 'var(--blue-700)' }} />
            <h3 style={{ margin: 0 }}>{isSk ? 'Kontakt na zodpovednú osobu (DPO)' : 'Data Protection Officer (DPO)'}</h3>
          </div>
          <p style={{ color: 'var(--ink-2)', margin: 0 }}>
            {isSk
              ? 'Nemocnica Snina, n.o. · Námestie slobody 1, 069 01 Snina, Slovenská republika · dpo@nemocnica-snina.sk'
              : 'Nemocnica Snina, n.o. · Námestie slobody 1, 069 01 Snina, Slovak Republic · dpo@nemocnica-snina.sk'}
          </p>
        </div>
      </div>
    </main>
  );
}

// ── Content ──────────────────────────────────────────────────────────────────

interface Section {
  heading: string;
  icon: React.ReactNode;
  paragraphs: string[];
  bullets?: string[];
}

const SK_SECTIONS: Section[] = [
  {
    heading: 'Prevádzkovateľ a právny základ',
    icon: <Shield size={20} aria-hidden="true" style={{ color: 'var(--blue-700)' }} />,
    paragraphs: [
      'Prevádzkovateľom je Nemocnica Snina, n.o., IČO 12345678, Námestie slobody 1, 069 01 Snina. Právnym základom spracúvania zdravotných údajov je čl. 9 ods. 2 písm. h) GDPR v spojení s § 78 ods. 1 zákona č. 18/2018 Z. z. — poskytovanie zdravotnej starostlivosti.',
    ],
  },
  {
    heading: 'Kategórie spracúvaných údajov',
    icon: <Eye size={20} aria-hidden="true" style={{ color: 'var(--blue-700)' }} />,
    paragraphs: ['Pri videokonzultácii spracúvame nasledujúce kategórie údajov:'],
    bullets: [
      'Identifikačné údaje: meno, dátum narodenia (odvodené z RČ — nie RČ samotné v čistom texte)',
      'Kontaktné údaje: telefónne číslo',
      'Zdravotné údaje: dôvod konzultácie, príznaky, aktuálne lieky, poznámky lekára',
      'Prevádzkové metadáta: čas začiatku a ukončenia konzultácie, technické záznamy spojenia',
      'Video/audio stream: prenášaný cez šifrované WebRTC spojenie (TLS 1.3 / DTLS-SRTP), nie je nahrávaný',
    ],
  },
  {
    heading: 'Nahrávanie — zákaz v základnom nastavení',
    icon: <Lock size={20} aria-hidden="true" style={{ color: 'var(--blue-700)' }} />,
    paragraphs: [
      'Video ani audio konzultácie sa nenahrávajú. Nahrávanie je technicky zablokované (TELEHEALTH_RECORDING_ENABLED=false) a môže byť aktivované výlučne na základe písomného súhlasu zodpovednej osoby za ochranu údajov (DPO) a vyžaduje samostatný súhlas pacienta pred každou nahrávanou konzultáciou.',
    ],
  },
  {
    heading: 'Technická bezpečnosť a uloženie',
    icon: <Lock size={20} aria-hidden="true" style={{ color: 'var(--blue-700)' }} />,
    paragraphs: [
      'Všetky dáta sú uložené výlučne na serveroch v Európskej únii (nariadenie Decree 179/2020). Šifrovanie v pokoji: AES-256-GCM. Šifrovanie pri prenose: TLS 1.3. Video stream: DTLS 1.2 / SRTP cez WebRTC.',
      'Opakujúce zhrnutia konzultácií sú po 7 dňoch automaticky vymazané (retenčná politika RETENTION.md). Zdravotná dokumentácia (klinická poznámka) je súčasťou trvalej zdravotnej dokumentácie pacienta podľa § 18 zákona č. 576/2004 Z. z.',
    ],
  },
  {
    heading: 'Vaše práva',
    icon: <FileText size={20} aria-hidden="true" style={{ color: 'var(--blue-700)' }} />,
    paragraphs: ['Máte právo:'],
    bullets: [
      'Na prístup k svojim údajom (čl. 15 GDPR)',
      'Na opravu nesprávnych údajov (čl. 16 GDPR)',
      'Na vymazanie, ak pominuli dôvody spracúvania (čl. 17 GDPR)',
      'Na obmedzenie spracúvania (čl. 18 GDPR)',
      'Na prenosnosť (čl. 20 GDPR)',
      'Podať sťažnosť na Úrad na ochranu osobných údajov SR (dataprotection.gov.sk)',
    ],
  },
];

const EN_SECTIONS: Section[] = [
  {
    heading: 'Controller and legal basis',
    icon: <Shield size={20} aria-hidden="true" style={{ color: 'var(--blue-700)' }} />,
    paragraphs: [
      'The controller is Nemocnica Snina, n.o., ID 12345678, Námestie slobody 1, 069 01 Snina, Slovak Republic. The legal basis for processing health data is Art. 9(2)(h) GDPR read with § 78(1) Act No. 18/2018 Coll. — provision of healthcare.',
    ],
  },
  {
    heading: 'Categories of data processed',
    icon: <Eye size={20} aria-hidden="true" style={{ color: 'var(--blue-700)' }} />,
    paragraphs: ['During a video consultation we process the following data:'],
    bullets: [
      'Identity data: name, date of birth (derived from birth number — the birth number itself is never stored in plain text)',
      'Contact data: phone number',
      'Health data: reason for consultation, symptoms, current medications, physician notes',
      'Operational metadata: session start/end time, technical connection logs',
      'Video/audio stream: transmitted over an encrypted WebRTC connection (TLS 1.3 / DTLS-SRTP); not recorded',
    ],
  },
  {
    heading: 'Recording — prohibited by default',
    icon: <Lock size={20} aria-hidden="true" style={{ color: 'var(--blue-700)' }} />,
    paragraphs: [
      'Video and audio consultations are not recorded. Recording is technically disabled (TELEHEALTH_RECORDING_ENABLED=false) and may only be enabled on the written authorisation of the Data Protection Officer and with a separate explicit consent from the patient before each recorded session.',
    ],
  },
  {
    heading: 'Technical security and storage',
    icon: <Lock size={20} aria-hidden="true" style={{ color: 'var(--blue-700)' }} />,
    paragraphs: [
      'All data is stored exclusively on servers within the European Union (Decree 179/2020). Encryption at rest: AES-256-GCM. Encryption in transit: TLS 1.3. Video stream: DTLS 1.2 / SRTP over WebRTC.',
      'Consultation summary PDFs are automatically purged after 7 days (RETENTION.md retention policy). The clinical note is part of the patient\'s permanent medical record under § 18 Act No. 576/2004 Coll.',
    ],
  },
  {
    heading: 'Your rights',
    icon: <FileText size={20} aria-hidden="true" style={{ color: 'var(--blue-700)' }} />,
    paragraphs: ['You have the right to:'],
    bullets: [
      'Access your data (Art. 15 GDPR)',
      'Rectify inaccurate data (Art. 16 GDPR)',
      'Erasure where the grounds for processing have lapsed (Art. 17 GDPR)',
      'Restriction of processing (Art. 18 GDPR)',
      'Data portability (Art. 20 GDPR)',
      'Lodge a complaint with the Slovak Data Protection Authority (dataprotection.gov.sk)',
    ],
  },
];
