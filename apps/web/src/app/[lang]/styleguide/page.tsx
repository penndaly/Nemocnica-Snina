import { getTranslations } from 'next-intl/server';
import { Plus, Heart, Activity, Shield, FlaskConical } from 'lucide-react';
import { SiteLayout } from '@/components/layout/SiteLayout';
import type { SupportedLocale } from '@/i18n/config';

export default async function StyleguidePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = lang as SupportedLocale;

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section style={{ marginBottom: '3rem' }}>
      <h2 style={{ borderBottom: '2px solid var(--line)', paddingBottom: '.5rem', marginBottom: '1.5rem' }}>{title}</h2>
      {children}
    </section>
  );

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '.75rem 0', borderBottom: '1px solid var(--line-2)', flexWrap: 'wrap' }}>
      <span style={{ width: 160, color: 'var(--ink-3)', fontSize: '.82rem', fontFamily: 'monospace', flexShrink: 0 }}>{label}</span>
      {children}
    </div>
  );

  const Swatch = ({ name, color }: { name: string; color: string }) => (
    <div style={{ textAlign: 'center', width: 80 }}>
      <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-sm)', background: color, margin: '0 auto .4rem', border: '1px solid var(--line)' }} />
      <div style={{ fontSize: '.68rem', fontFamily: 'monospace', color: 'var(--ink-3)' }}>{name}</div>
    </div>
  );

  return (
    <SiteLayout>
      <div style={{ padding: '2.5rem 0 5rem' }}>
        <div className="container">
          <p className="eyebrow">Design system</p>
          <h1 style={{ marginBottom: '2.5rem' }}>Styleguide — Nemocnica Snina</h1>

          {/* Colors */}
          <Section title="Colors">
            <h3 style={{ marginBottom: '1rem' }}>Medical blue (trust)</h3>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
              {[900, 800, 700, 600, 500, 200, 100, 50].map((n) => (
                <Swatch key={n} name={`--blue-${n}`} color={`var(--blue-${n})`} />
              ))}
            </div>
            <h3 style={{ marginBottom: '1rem' }}>Warm neutrals</h3>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
              {['--bg', '--bg-2', '--surface', '--warm-100', '--warm-200', '--line', '--line-2'].map((t) => (
                <Swatch key={t} name={t} color={`var(${t})`} />
              ))}
            </div>
            <h3 style={{ marginBottom: '1rem' }}>Accents</h3>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {['--terra', '--terra-50', '--green', '--green-50', '--amber', '--amber-50', '--red', '--red-50'].map((t) => (
                <Swatch key={t} name={t} color={`var(${t})`} />
              ))}
            </div>
          </Section>

          {/* Typography */}
          <Section title="Typography">
            <h1>H1 — Newsreader 600 (clamp 2.2–3.5rem)</h1>
            <h2>H2 — Newsreader 600 (clamp 1.7–2.4rem)</h2>
            <h3>H3 — Newsreader 600 · 1.35rem</h3>
            <h4>H4 — Mulish 700 · 1.1rem</h4>
            <p className="eyebrow">Eyebrow — Mulish 700 .76rem uppercase ls .14em</p>
            <p className="lede">Lede paragraph — Mulish 400 1.2rem color ink-2 leading 1.55</p>
            <p>Body paragraph — Mulish 400 17px leading 1.6. Renders body text with sufficient contrast for WCAG 2.1 AA.</p>
            <p className="muted">Muted text — color ink-3</p>
          </Section>

          {/* Buttons */}
          <Section title="Buttons">
            <Row label=".btn-primary">
              <a href="#" className="btn btn-primary">Primary</a>
              <a href="#" className="btn btn-primary btn-sm">Small</a>
              <a href="#" className="btn btn-primary btn-lg">Large</a>
              <button className="btn btn-primary" disabled>Disabled</button>
            </Row>
            <Row label=".btn-terra">
              <a href="#" className="btn btn-terra">Terracotta</a>
              <a href="#" className="btn btn-terra btn-sm">Small</a>
            </Row>
            <Row label=".btn-ghost">
              <a href="#" className="btn btn-ghost">Ghost</a>
              <a href="#" className="btn btn-ghost btn-sm">Small</a>
            </Row>
            <Row label=".btn-emergency">
              <a href="#" className="btn btn-emergency"><Plus size={16} /> 112</a>
            </Row>
          </Section>

          {/* Badges */}
          <Section title="Badges">
            <Row label="Colors">
              {[
                { cls: 'badge-green', label: 'Green · open' },
                { cls: 'badge-amber', label: 'Amber · alert' },
                { cls: 'badge-red',   label: 'Red · emergency' },
                { cls: 'badge-blue',  label: 'Blue · info' },
                { cls: 'badge-terra', label: 'Terra · new' },
                { cls: 'badge-gray',  label: 'Gray · closed' },
              ].map(({ cls, label }) => (
                <span key={cls} className={`badge ${cls}`}>
                  <span className="dot" />
                  {label}
                </span>
              ))}
            </Row>
          </Section>

          {/* Chips */}
          <Section title="Chips">
            <Row label=".chip">
              <span className="chip"><Activity size={13} /> Chip with icon</span>
              <span className="chip">Plain chip</span>
              <span className="lang-tag">SK</span>
              <span className="lang-tag">EN</span>
            </Row>
          </Section>

          {/* Cards */}
          <Section title="Cards">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              <div className="card card-pad">
                <h4>Basic card</h4>
                <p style={{ color: 'var(--ink-2)', margin: 0, fontSize: '.9rem' }}>Standard content card with 1.5rem padding.</p>
              </div>
              <a href="#" className="card card-pad card-hover" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                <h4>Hover card</h4>
                <p style={{ color: 'var(--ink-2)', margin: 0, fontSize: '.9rem' }}>Lifts on hover with box-shadow.</p>
              </a>
              <div className="card card-pad" style={{ borderTop: '4px solid var(--blue-600)' }}>
                <h4>Accented card</h4>
                <p style={{ color: 'var(--ink-2)', margin: 0, fontSize: '.9rem' }}>4px top border accent.</p>
              </div>
            </div>
          </Section>

          {/* Avatar */}
          <Section title="Avatar">
            <Row label=".avatar">
              <div className="avatar">JM</div>
              <div className="avatar avatar-lg">AB</div>
            </Row>
          </Section>

          {/* Image placeholder */}
          <Section title="Image placeholder (.ph)">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="ph" style={{ aspectRatio: '16/9' }} data-label="16:9 placeholder" role="img" aria-label="16:9 placeholder" />
              <div className="ph" style={{ aspectRatio: '1/1', maxWidth: 200 }} data-label="1:1 square" role="img" aria-label="Square placeholder" />
            </div>
          </Section>

          {/* Form controls */}
          <Section title="Form controls">
            <div style={{ maxWidth: 480, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <label className="field">
                <span>Text input</span>
                <input type="text" placeholder="Placeholder text" />
              </label>
              <label className="field">
                <span>Select</span>
                <select>
                  <option>Option A</option>
                  <option>Option B</option>
                </select>
              </label>
              <label className="field">
                <span>Textarea</span>
                <textarea rows={3} placeholder="Multiline text…" />
              </label>
              <label style={{ display: 'flex', gap: '.5rem', cursor: 'pointer', alignItems: 'center' }}>
                <input type="checkbox" style={{ width: 18, height: 18, accentColor: 'var(--blue-700)' }} />
                <span>Checkbox label</span>
              </label>
            </div>
          </Section>

          {/* Data table */}
          <Section title="Data table (table.data)">
            <div className="card" style={{ overflowX: 'auto' }}>
              <table className="data">
                <thead>
                  <tr>
                    <th>Column A</th><th>Column B</th><th>Status</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Row 1, A</td><td>Row 1, B</td>
                    <td><span className="badge badge-green"><span className="dot"/>Open</span></td>
                    <td><a href="#" className="btn btn-ghost btn-sm">Edit</a></td>
                  </tr>
                  <tr>
                    <td>Row 2, A</td><td>Row 2, B</td>
                    <td><span className="badge badge-amber">Limited</span></td>
                    <td><a href="#" className="btn btn-ghost btn-sm">Edit</a></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          {/* Stepper */}
          <Section title="Stepper">
            <div className="stepper" role="list">
              {['Clinic', 'Date', 'Time', 'Details', 'Confirm'].map((label, i) => (
                <div
                  key={label}
                  className={`stepper-step${i < 2 ? ' done' : i === 2 ? ' active' : ''}`}
                  role="listitem"
                >
                  {label}
                </div>
              ))}
            </div>
          </Section>

          {/* Bands */}
          <Section title="Background bands">
            <div className="band-warm" style={{ borderRadius: 'var(--radius)', marginBottom: '.75rem', padding: '1.5rem 2rem' }}>
              <p style={{ margin: 0 }}><strong>.band-warm</strong> — background var(--bg-2) · used for sections</p>
            </div>
            <div className="band-blue" style={{ borderRadius: 'var(--radius)', padding: '1.5rem 2rem' }}>
              <p style={{ margin: 0, color: '#d6e2f0' }}><strong>.band-blue</strong> — background var(--blue-900) · dark CTA sections</p>
            </div>
          </Section>
        </div>
      </div>
    </SiteLayout>
  );
}
