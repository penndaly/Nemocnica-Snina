import { getTranslations } from 'next-intl/server';
import { Phone, Mail, MapPin } from 'lucide-react';
import Link from 'next/link';
import { SiteLayout } from '@/components/layout/SiteLayout';
import { ApsCard } from '@/components/ApsCard';
import { getHospitalInfo, getPageContent } from '@/lib/strapi-client';
import { localizeField } from '@/lib/i18n-utils';
import type { SupportedLocale } from '@/i18n/config';

export default async function ContactPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = lang as SupportedLocale;
  const t = await getTranslations({ locale });
  const [h, pages] = await Promise.all([
    getHospitalInfo(locale),
    getPageContent(locale),
  ]);
  const about = pages.about;
  const aps = pages.aps;

  return (
    <SiteLayout activePath={`/${locale}/kontakt`}>
      {/* Page hero — about */}
      <div style={{ padding: '2.5rem 0', background: 'var(--bg-2)', borderBottom: '1px solid var(--line)' }}>
        <div className="container-narrow">
          <p className="eyebrow">{t('nav.contact')}</p>
          <h1 style={{ marginBottom: '.75rem' }}>{localizeField(about.title, locale)}</h1>
          <p className="lede">{localizeField(about.body, locale)}</p>
        </div>
      </div>

      {/* 2-col body */}
      <div style={{ padding: '2.5rem 0 4rem' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr .85fr', gap: '2.5rem', alignItems: 'start' }}>
            {/* Left */}
            <div>
              {/* Map placeholder */}
              <div
                className="ph"
                style={{ aspectRatio: '16/9', marginBottom: '1.5rem', borderRadius: 'var(--radius)' }}
                data-label={locale === 'sk' ? 'Mapa areálu nemocnice' : 'Hospital campus map'}
                role="img"
                aria-label={locale === 'sk' ? 'Mapa areálu nemocnice' : 'Hospital campus map'}
              />

              <h2 style={{ marginBottom: '1rem' }}>
                {locale === 'sk' ? 'Kde nás nájdete' : 'Where to find us'}
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem', marginBottom: '2rem' }}>
                {[
                  { icon: <MapPin size={16} />, label: locale === 'sk' ? 'Adresa' : 'Address', value: h.address },
                  { icon: <Phone size={16} />, label: locale === 'sk' ? 'Centrála' : 'Switchboard', value: h.phone, href: `tel:${h.phone.replace(/\s/g, '')}` },
                  { icon: <Phone size={16} />, label: locale === 'sk' ? 'Recepcia' : 'Reception', value: h.reception, href: `tel:${h.reception.replace(/[\s/]/g, '')}` },
                  { icon: <Phone size={16} />, label: locale === 'sk' ? 'Lekáreň' : 'Pharmacy', value: h.pharmacy, href: `tel:${h.pharmacy.replace(/[\s/]/g, '')}` },
                  { icon: <Mail size={16} />, label: 'Email', value: h.email, href: `mailto:${h.email}` },
                ].map(({ icon, label, value, href }) => (
                  <div key={label} className="card card-pad" style={{ display: 'flex', gap: '.75rem', alignItems: 'flex-start' }}>
                    <div style={{ color: 'var(--blue-600)', marginTop: 2 }} aria-hidden>{icon}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '.78rem', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-3)', marginBottom: '.2rem' }}>
                        {label}
                      </div>
                      {href ? (
                        <a href={href} style={{ color: 'var(--blue-700)', fontWeight: 600 }}>{value}</a>
                      ) : (
                        <span>{value}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* APS block — live schedule via /api/aps (Sprint S2) */}
              <div style={{ marginBottom: '2rem' }} role="complementary">
                <ApsCard
                  title={localizeField(aps.title, locale)}
                  note={localizeField(aps.note, locale)}
                  locale={locale}
                />
              </div>

              {/* Cookie notice — strictly-necessary cookies only, no consent banner needed */}
              <section id="cookies" tabIndex={-1} aria-labelledby="cookies-heading" style={{ marginBottom: '2rem' }}>
                <h2 id="cookies-heading" style={{ marginBottom: '.75rem' }}>
                  {locale === 'sk' ? 'Informácia o súboroch cookies' : 'Cookie notice'}
                </h2>
                <div className="card card-pad" style={{ fontSize: '.88rem', color: 'var(--ink-2)' }}>
                  {locale === 'sk'
                    ? 'Táto webová stránka používa výlučne nevyhnutné súbory cookies potrebné na fungovanie stránky (prihlásenie, zabezpečenie relácie). Nepoužívame analytické, reklamné ani sledovacie cookies. Súhlas so spracúvaním cookies nie je potrebný — funkčné cookies sú na základe oprávneného záujmu prevádzkovateľa v súlade s čl. 6(1)(f) GDPR.'
                    : 'This website uses strictly necessary cookies only (login session, security). We do not use analytics, advertising, or tracking cookies. No cookie consent is required — functional cookies are used on the basis of legitimate interest under Art. 6(1)(f) GDPR.'}
                </div>
              </section>

              {/* GDPR section */}
              <section id="gdpr" tabIndex={-1} aria-labelledby="gdpr-heading">
                <h2 id="gdpr-heading" style={{ marginBottom: '.75rem' }}>
                  {locale === 'sk' ? 'Ochrana osobných údajov (GDPR)' : 'Privacy policy (GDPR)'}
                </h2>
                <div className="card card-pad" style={{ marginBottom: '1rem' }}>
                  <p style={{ color: 'var(--ink-2)', fontSize: '.92rem' }}>
                    {locale === 'sk'
                      ? 'Nemocnica Snina, s.r.o. spracúva osobné údaje v súlade s Nariadením (EÚ) 2016/679 (GDPR) a zákonom č. 18/2018 Z.z. o ochrane osobných údajov. Právnym základom spracúvania je plnenie zmluvy (čl. 6(1)(b) GDPR), zákonné povinnosti (čl. 6(1)(c)) a oprávnený záujem prevádzkovateľa (čl. 6(1)(f)). Spracúvanie zdravotných údajov prebieha na základe čl. 9(2)(h) GDPR. Ako dotknutá osoba máte právo na prístup, opravu, vymazanie a prenosnosť údajov, ako aj právo namietať spracúvanie. Žiadosti zasielajte na: sekretariat@nemocnicasnina.sk'
                      : 'Nemocnica Snina, s.r.o. processes personal data in accordance with Regulation (EU) 2016/679 (GDPR) and Act No. 18/2018 Coll. on the protection of personal data. The legal basis for processing is the performance of a contract (Art. 6(1)(b) GDPR), legal obligations (Art. 6(1)(c)) and legitimate interests (Art. 6(1)(f)). Processing of health data is based on Art. 9(2)(h) GDPR. As a data subject you have the right to access, rectification, erasure and portability, as well as the right to object. Send requests to: sekretariat@nemocnicasnina.sk'}
                  </p>
                </div>
                {/* Retention policy reference */}
                <p style={{ fontSize: '.82rem', color: 'var(--ink-3)' }}>
                  {locale === 'sk'
                    ? <>Doby uchovávania osobných údajov a právne základy sú zdokumentované v <a href="/RETENTION.md" style={{ color: 'var(--blue-700)' }}>politike uchovávania údajov</a>. Žiadosti o prístup alebo výmaz (čl. 15 / 17 GDPR) zasielajte na vyššie uvedenú e-mailovú adresu.</>
                    : <>Retention periods and legal bases are documented in our <a href="/RETENTION.md" style={{ color: 'var(--blue-700)' }}>data retention policy</a>. Access and erasure requests (Art. 15 / 17 GDPR) may be submitted to the email address above.</>}
                </p>
              </section>

              {/* Accessibility statement */}
              <section id="pristupnost" tabIndex={-1} aria-labelledby="a11y-heading" style={{ marginTop: '2rem' }}>
                <h2 id="a11y-heading" style={{ marginBottom: '.75rem' }}>
                  {locale === 'sk' ? 'Vyhlásenie o prístupnosti' : 'Accessibility statement'}
                </h2>
                <div className="card card-pad">
                  <p style={{ color: 'var(--ink-2)', fontSize: '.92rem', marginBottom: '.75rem' }}>
                    {locale === 'sk'
                      ? 'Nemocnica Snina, s.r.o. sa zaväzuje zabezpečiť prístupnosť svojho webového sídla v súlade so zákonom č. 351/2022 Z.z. o prístupnosti webových sídiel a mobilných aplikácií. Cieľom je splniť úroveň WCAG 2.1 AA. Ak máte problém s prístupnosťou stránky, kontaktujte nás na sekretariat@nemocnicasnina.sk. Na vašu správu odpovieme do 5 pracovných dní.'
                      : 'Nemocnica Snina, s.r.o. is committed to ensuring the accessibility of its website in accordance with Act No. 351/2022 Coll. on the accessibility of websites and mobile applications. The target conformance level is WCAG 2.1 AA. If you experience an accessibility issue, contact us at sekretariat@nemocnicasnina.sk. We will reply within 5 working days.'}
                  </p>
                  <p style={{ color: 'var(--ink-3)', fontSize: '.82rem' }}>
                    {locale === 'sk'
                      ? 'Posledný audit prístupnosti (axe-core/Playwright, WCAG 2.1 AA): aktualizujte po dokončení auditu L3 (pozri LAUNCH_CHECKLIST.md). Metóda hodnotenia: automatizovaná — axe DevTools + manuálna — klávesnica + čítač obrazovky (NVDA/VoiceOver).'
                      : 'Last accessibility audit (axe-core/Playwright, WCAG 2.1 AA): update after L3 audit completion (see LAUNCH_CHECKLIST.md). Assessment method: automated — axe DevTools + manual — keyboard + screen reader (NVDA/VoiceOver).'}
                  </p>
                </div>
              </section>
            </div>

            {/* Right: sticky quick-contact */}
            <aside style={{ position: 'sticky', top: 'calc(var(--header-h) + 1rem)' }}>
              <div className="card card-pad" style={{ borderTop: '4px solid var(--blue-600)' }}>
                <h3 style={{ marginBottom: '1rem' }}>
                  {locale === 'sk' ? 'Rýchly kontakt' : 'Quick contact'}
                </h3>
                <dl style={{ display: 'flex', flexDirection: 'column', gap: '.6rem', fontSize: '.9rem' }}>
                  {[
                    { label: locale === 'sk' ? 'Centrála' : 'Switchboard', val: h.phone, href: `tel:${h.phone.replace(/\s/g, '')}` },
                    { label: 'Recepcia', val: h.reception, href: `tel:${h.reception.replace(/[\s/]/g, '')}` },
                    { label: locale === 'sk' ? 'Lekáreň' : 'Pharmacy', val: h.pharmacy, href: `tel:${h.pharmacy.replace(/[\s/]/g, '')}` },
                    { label: 'IČO', val: h.ico },
                    { label: 'DIČ', val: h.dic },
                  ].map(({ label, val, href }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--line)', paddingBottom: '.4rem' }}>
                      <dt style={{ color: 'var(--ink-3)', fontWeight: 700, fontSize: '.78rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</dt>
                      <dd style={{ margin: 0 }}>
                        {href ? (
                          <a href={href} style={{ color: 'var(--blue-700)', fontWeight: 700 }}>{val}</a>
                        ) : (
                          <span style={{ fontFamily: 'monospace' }}>{val}</span>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
                <div style={{ marginTop: '1rem' }}>
                  <Link href={`/${locale}/objednanie`} className="btn btn-primary btn-block btn-sm">
                    {t('book')}
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
