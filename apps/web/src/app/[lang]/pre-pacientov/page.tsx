import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Calendar } from 'lucide-react';
import { PageHero } from '@ns/ui';
import { SiteLayout } from '@/components/layout/SiteLayout';
import { ScrollArea } from '@/components/ScrollArea';
import { getPricing, getWaitingTimes, getTestimonials, getHospitalInfo } from '@/lib/strapi-client';
import { localizeField } from '@/lib/i18n-utils';
import type { SupportedLocale } from '@/i18n/config';
import type { WaitingTimeLevel } from '@ns/types';

const WAIT_BADGE: Record<WaitingTimeLevel, string> = {
  good: 'badge-green',
  ok: 'badge-amber',
  closed: 'badge-red',
};

const JUMP_LINKS: Array<{ href: string; sk: string; en: string }> = [
  { href: '#cennik', sk: 'Cenník', en: 'Price list' },
  { href: '#cakacie-lehoty', sk: 'Čakacie lehoty', en: 'Waiting times' },
  { href: '#informacie', sk: 'Informácie pred prijatím', en: 'Admission info' },
  { href: '#podakovania', sk: 'Poďakovania', en: 'Testimonials' },
];

export default async function ForPatientsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = lang as SupportedLocale;
  const t = await getTranslations({ locale });
  const [pricing, waitingTimes, testimonials, hospital] = await Promise.all([
    getPricing(locale),
    getWaitingTimes(locale),
    getTestimonials(locale),
    getHospitalInfo(locale),
  ]);

  return (
    <SiteLayout activePath={`/${locale}/pre-pacientov`}>
      <PageHero
        slot="patients-hero"
        alt=""
        breadcrumb={{ homeLabel: t('backHome'), homeHref: `/${locale}`, here: t('nav.patients') }}
      >
        <p className="eyebrow">{locale === 'sk' ? 'Pre pacientov' : 'For patients'}</p>
        <h1>{locale === 'sk' ? 'Všetko, čo potrebujete pred návštevou' : 'Everything you need before your visit'}</h1>
        <p className="lede">
          {locale === 'sk'
            ? 'Ceny pre samoplatcov, čakacie lehoty na jednotlivé ambulancie, dotazník spokojnosti, podávanie sťažností a poďakovania pacientov — na jednom mieste.'
            : 'Self-pay pricing, clinic waiting times, a satisfaction survey, complaint submission and patient testimonials — all in one place.'}
        </p>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
          {JUMP_LINKS.map((jump) => (
            <a key={jump.href} href={jump.href} className="chip">
              {locale === 'sk' ? jump.sk : jump.en}
            </a>
          ))}
        </div>
      </PageHero>

      {/* Price list */}
      <div className="section" id="cennik" style={{ scrollMarginTop: 90 }}>
        <div className="container">
          <h2>{locale === 'sk' ? 'Cenník pre samoplatcov' : 'Price list for self-pay patients'}</h2>
          <p className="muted" style={{ maxWidth: '70ch' }}>
            {locale === 'sk'
              ? 'Cenník pre samoplatcov, zostavený z platných dokumentov nemocnice (cenník SM-06 platný od 1.10.2025, cenník biochémie a cenník hematológie). Namiesto troch samostatných PDF súborov je tu ako prehľadná, vyhľadateľná tabuľka.'
              : "Self-pay pricing compiled from the hospital's current documents (price list SM-06 valid from 1 Oct 2025, biochemistry and hematology price lists). Shown here as one searchable table instead of three separate PDFs."}
          </p>
          <div className="table-wrap mt-2">
            <ScrollArea label={locale === 'sk' ? 'Cenník pre samoplatcov' : 'Self-pay price list'}>
              <table className="data">
                <thead>
                  <tr>
                    <th>{locale === 'sk' ? 'Kategória' : 'Category'}</th>
                    <th>{locale === 'sk' ? 'Výkon' : 'Service'}</th>
                    <th>{locale === 'sk' ? 'Cena' : 'Price'}</th>
                  </tr>
                </thead>
                <tbody>
                  {pricing.map((p) => (
                    <tr key={p.id}>
                      <td>{localizeField(p.category, locale)}</td>
                      <td>{localizeField(p.item, locale)}</td>
                      <td><b>{p.price}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        </div>
      </div>

      {/* Waiting times */}
      <div className="section band-warm" id="cakacie-lehoty" style={{ scrollMarginTop: 90 }}>
        <div className="container">
          <h2>{locale === 'sk' ? 'Čakacie lehoty na ambulancie' : 'Clinic waiting times'}</h2>
          <p className="muted" style={{ maxWidth: '70ch' }}>
            {locale === 'sk'
              ? 'Doteraz sme čakacie lehoty nezverejňovali priamo — pacienti museli hľadať na stránkach poisťovní (Dôvera, VšZP, Union). Tu je aktuálny odhad pre každú ambulanciu priamo na jednom mieste.'
              : "Waiting times weren't published directly before — patients had to check insurer sites (Dôvera, VšZP, Union) separately. Here's a current estimate for every clinic, in one place."}
          </p>
          <div className="card mt-2">
            {waitingTimes.map((w) => (
              <div key={w.id} className="wait-row">
                <span className="wr-clinic">{localizeField(w.clinic, locale)}</span>
                <span className={`badge ${WAIT_BADGE[w.level]}`}>{localizeField(w.wait, locale)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Admission info */}
      <div className="section" id="informacie" style={{ scrollMarginTop: 90 }}>
        <div className="container">
          <h2>{locale === 'sk' ? 'Informácie pred prijatím' : 'Before your admission'}</h2>
          <div className="grid grid-2 mt-2">
            <div className="card card-pad">
              <h3>{locale === 'sk' ? 'Čo si priniesť' : 'What to bring'}</h3>
              <ul>
                <li>{locale === 'sk' ? 'Preukaz zdravotnej poisťovne a občiansky preukaz' : 'Your health-insurance card and ID'}</li>
                <li>{locale === 'sk' ? 'Výmenný lístok od odosielajúceho lekára (ak je vyžadovaný)' : 'A referral note from your referring physician (if required)'}</li>
                <li>{locale === 'sk' ? 'Predchádzajúcu zobrazovaciu dokumentáciu (MRI, CT, RTG), ak existuje' : 'Prior imaging records (MRI, CT, X-ray), if available'}</li>
                <li>{locale === 'sk' ? 'Zoznam aktuálne užívaných liekov' : 'A list of medications you currently take'}</li>
              </ul>
              <Link href={`/${locale}/objednanie`} className="btn btn-primary btn-sm mt-1">
                <Calendar size={16} aria-hidden />
                {t('book')}
              </Link>
            </div>
            <div className="card card-pad">
              <h3>{locale === 'sk' ? 'Lekárenská pohotovosť' : 'Pharmacy on-call service'}</h3>
              <p>
                {locale === 'sk'
                  ? 'Nemocničná lekáreň vydáva lieky na recept aj voľnopredajné, s hodinami zosúladenými s ambulanciami.'
                  : 'The hospital pharmacy dispenses both prescription and over-the-counter medicine, with hours aligned to the clinics.'}
              </p>
              <p style={{ marginBottom: 0 }}>
                <b>{locale === 'sk' ? 'Lekáreň' : 'Pharmacy'}:</b> {hospital.pharmacy}
                <br />
                <Link href={`/${locale}/diagnostika`}>
                  {locale === 'sk' ? 'Viac o diagnostike a lekárni →' : 'More on diagnostics & pharmacy →'}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Testimonials */}
      <div className="section band-warm" id="podakovania" style={{ scrollMarginTop: 90 }}>
        <div className="container">
          <h2>{locale === 'sk' ? 'Poďakovania pacientov' : 'Patient testimonials'}</h2>
          <div className="grid grid-3 mt-2">
            {testimonials.map((x) => (
              <div key={x.id} className="card card-pad quote-card">
                <blockquote>&ldquo;{localizeField(x.quote, locale)}&rdquo;</blockquote>
                <cite>{localizeField(x.author, locale)}</cite>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
