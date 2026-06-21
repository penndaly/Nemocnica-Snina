import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { Plus } from 'lucide-react';
import type { SupportedLocale } from '@/i18n/config';

const HOSPITAL_ADDRESS = 'Sládkovičova 300/3, 069 01 Snina';
const HOSPITAL_PHONE = '+421 57 766 01 11';
const HOSPITAL_EMAIL = 'sekretariat@nemocnicasnina.sk';
const CURRENT_YEAR = new Date().getFullYear();

export function SiteFooter() {
  const t = useTranslations();
  const locale = useLocale() as SupportedLocale;

  const col2 = [
    { href: `/${locale}/oddelenia`, label: t('nav.departments') },
    { href: `/${locale}/ambulancie`, label: t('nav.clinics') },
    { href: `/${locale}/lekari`, label: t('nav.doctors') },
    { href: `/${locale}/diagnostika`, label: t('nav.diagnostics') },
  ];

  const col3 = [
    { href: `/${locale}/objednanie`,  label: t('book') },
    { href: `/${locale}/telehealth`,  label: t('nav.telehealth') },
    { href: `/${locale}/registracia`, label: locale === 'sk' ? 'Registrácia nového pacienta' : 'New patient registration' },
    { href: `/${locale}/portal`,      label: t('portal.title')},
    { href: `/${locale}/sluzby`,      label: t('nav.services') },
    { href: `/${locale}/aktuality`,   label: t('nav.news') },
  ];

  const col4 = [
    { href: `/${locale}/zverejnovanie`, label: t('footer.disclosures') },
    { href: `/${locale}/kontakt#gdpr`, label: t('footer.privacy') },
    { href: `/${locale}/kontakt#pristupnost`, label: t('footer.accessibility') },
    { href: '/admin', label: t('footer.admin') },
  ];

  const FooterLink = ({ href, label }: { href: string; label: string }) => (
    <li>
      <Link
        href={href}
        style={{ color: 'var(--blue-200)', fontSize: '.9rem', textDecoration: 'none' }}
      >
        {label}
      </Link>
    </li>
  );

  return (
    <footer
      style={{
        background: 'var(--blue-900)',
        color: '#d6e2f0',
        paddingTop: '3rem',
        paddingBottom: 0,
      }}
    >
      <div className="container">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '2rem',
            paddingBottom: '2.5rem',
          }}
        >
          {/* Col 1: Brand + address */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', marginBottom: '1rem' }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 9,
                  background: 'var(--blue-700)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-hidden
              >
                <Plus size={18} color="white" strokeWidth={2.5} />
              </div>
              <div>
                <div
                  style={{
                    fontFamily: 'Newsreader, Georgia, serif',
                    fontWeight: 600,
                    fontSize: '1.05rem',
                    color: '#fff',
                  }}
                >
                  Nemocnica Snina
                </div>
              </div>
            </div>
            <address
              style={{ fontStyle: 'normal', fontSize: '.88rem', color: 'var(--blue-200)', lineHeight: 1.7 }}
            >
              {HOSPITAL_ADDRESS}
              <br />
              <a href={`tel:${HOSPITAL_PHONE.replace(/\s/g, '')}`} style={{ color: 'inherit' }}>
                {HOSPITAL_PHONE}
              </a>
              <br />
              <a href={`mailto:${HOSPITAL_EMAIL}`} style={{ color: 'inherit' }}>
                {HOSPITAL_EMAIL}
              </a>
            </address>
          </div>

          {/* Col 2: Care */}
          <div>
            <h3
              style={{
                fontFamily: 'Mulish, sans-serif',
                fontWeight: 800,
                fontSize: '.78rem',
                letterSpacing: '.1em',
                textTransform: 'uppercase',
                color: '#fff',
                marginBottom: '.8rem',
              }}
            >
              {t('footer.care')}
            </h3>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
              {col2.map((item) => (
                <FooterLink key={item.href} {...item} />
              ))}
            </ul>
          </div>

          {/* Col 3: For patients */}
          <div>
            <h3
              style={{
                fontFamily: 'Mulish, sans-serif',
                fontWeight: 800,
                fontSize: '.78rem',
                letterSpacing: '.1em',
                textTransform: 'uppercase',
                color: '#fff',
                marginBottom: '.8rem',
              }}
            >
              {t('footer.patients')}
            </h3>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
              {col3.map((item) => (
                <FooterLink key={item.href} {...item} />
              ))}
            </ul>
          </div>

          {/* Col 4: Mandatory information */}
          <div>
            <h3
              style={{
                fontFamily: 'Mulish, sans-serif',
                fontWeight: 800,
                fontSize: '.78rem',
                letterSpacing: '.1em',
                textTransform: 'uppercase',
                color: '#fff',
                marginBottom: '.8rem',
              }}
            >
              {t('footer.legal')}
            </h3>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
              {col4.map((item) => (
                <FooterLink key={item.href} {...item} />
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,.12)',
            padding: '1rem 0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '.5rem',
            fontSize: '.82rem',
            color: 'var(--blue-200)',
          }}
        >
          <span>
            © {CURRENT_YEAR} Nemocnica Snina, s.r.o. {t('footer.rights')}
          </span>
          <span>WCAG 2.1 AA · Act No. 351/2022</span>
        </div>
      </div>
    </footer>
  );
}
