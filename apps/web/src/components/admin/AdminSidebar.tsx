'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2, Calendar, User, Activity, FlaskConical, Newspaper,
  FileText, Shield, Edit3, Download, ExternalLink, LogOut, Plus,
  Wrench, Lock, Video, CalendarCheck, Watch, ScrollText, Languages,
  Users, HeartPulse,
} from 'lucide-react';
import { useAdminAuth } from './AdminAuthContext';
import { SCHEMAS, SINGLETONS } from './admin-schemas';
import type { Seed } from '@ns/types';

const COLL_ICONS: Record<string, React.ReactNode> = {
  departments: <Building2 size={16} />,
  clinics:     <Calendar   size={16} />,
  physicians:  <User       size={16} />,
  services:    <Activity   size={16} />,
  facilities:  <FlaskConical size={16} />,
  news:        <Newspaper  size={16} />,
  disclosures: <Download   size={16} />,
};

const SING_ICONS: Record<string, React.ReactNode> = {
  hospital: <Shield size={16} />,
  pages:    <Edit3  size={16} />,
};

interface AdminSidebarProps {
  data: Seed;
}

export function AdminSidebar({ data }: AdminSidebarProps) {
  const { logout, email, role } = useAdminAuth();
  const pathname = usePathname();

  const NavItem = ({
    href,
    label,
    icon,
    count,
  }: {
    href: string;
    label: string;
    icon: React.ReactNode;
    count?: number;
  }) => {
    const active = pathname === href || pathname.startsWith(href + '/');
    return (
      <Link
        href={href}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '.65rem',
          padding: '.5rem .75rem',
          borderRadius: 8,
          background: active ? 'rgba(255,255,255,.1)' : 'transparent',
          color: active ? '#fff' : 'rgba(255,255,255,.65)',
          textDecoration: 'none',
          fontSize: '.88rem',
          fontWeight: active ? 700 : 500,
          transition: 'background .12s, color .12s',
        }}
      >
        <span style={{ opacity: active ? 1 : 0.7 }}>{icon}</span>
        <span style={{ flex: 1 }}>{label}</span>
        {count !== undefined && (
          <span
            style={{
              background: 'rgba(255,255,255,.15)',
              color: 'rgba(255,255,255,.75)',
              borderRadius: 999,
              fontSize: '.72rem',
              fontWeight: 700,
              padding: '0 .55em',
              minWidth: '1.4em',
              textAlign: 'center',
            }}
          >
            {count}
          </span>
        )}
      </Link>
    );
  };

  const SectionLabel = ({ text }: { text: string }) => (
    <p
      style={{
        fontFamily: 'Mulish, sans-serif',
        fontWeight: 800,
        fontSize: '.68rem',
        letterSpacing: '.12em',
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,.35)',
        margin: '1rem 0 .3rem .75rem',
      }}
    >
      {text}
    </p>
  );

  const countFor = (key: string): number => {
    const k = key as keyof Seed;
    const val = data[k];
    return Array.isArray(val) ? val.length : 0;
  };

  return (
    <aside
      style={{
        width: 240,
        flexShrink: 0,
        background: '#0f1923',
        borderRight: '1px solid rgba(255,255,255,.07)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        position: 'sticky',
        top: 0,
      }}
    >
      {/* Brand */}
      <Link
        href="/"
        target="_blank"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '.65rem',
          padding: '1.2rem 1rem',
          borderBottom: '1px solid rgba(255,255,255,.07)',
          textDecoration: 'none',
          color: '#fff',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'var(--blue-700)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Plus size={16} color="white" strokeWidth={2.5} />
        </div>
        <div>
          <div style={{ fontFamily: 'Newsreader, serif', fontWeight: 600, fontSize: '.95rem', lineHeight: 1.1 }}>
            Nemocnica Snina
          </div>
          <div style={{ fontSize: '.68rem', color: 'rgba(255,255,255,.4)', marginTop: 1 }}>
            Správa obsahu
          </div>
        </div>
      </Link>

      {/* Nav */}
      <div style={{ flex: 1, padding: '.5rem .6rem', overflowY: 'auto' }}>
        <SectionLabel text="Obsah" />
        {Object.entries(SCHEMAS).map(([key, schema]) => (
          <NavItem
            key={key}
            href={`/admin/${key}`}
            label={schema.label.sk}
            icon={COLL_ICONS[key] ?? <FileText size={16} />}
            count={countFor(key)}
          />
        ))}

        <SectionLabel text="Nastavenia" />
        {Object.entries(SINGLETONS).map(([key, schema]) => (
          <NavItem
            key={key}
            href={`/admin/settings/${key}`}
            label={schema.label.sk}
            icon={SING_ICONS[key] ?? <Shield size={16} />}
          />
        ))}

        <SectionLabel text="Prevádzka" />
        <NavItem href="/admin/bookings" label="Objednania" icon={<CalendarCheck size={16} />} />
        <NavItem href="/admin/onboarding" label="eDohody — Žiadosti" icon={<User size={16} />} count={0} />
        <NavItem href="/admin/gdpr" label="GDPR — DSAR / Výmaz" icon={<Lock size={16} />} />
        <NavItem href="/admin/translations" label="Preklady — na kontrolu" icon={<Languages size={16} />} />

        {/* Telehealth — clinician and admin only */}
        {['CLINICIAN', 'ADMIN'].includes(role ?? '') && (
          <>
            <SectionLabel text="Telehealth" />
            <NavItem href="/admin/telehealth" label="Plán konzultácií" icon={<Video size={16} />} />
          </>
        )}

        {/* Wearables + monitoring — administrator and super_admin only, matching
            the @StaffRoles gate on the monitoring/platform controllers. */}
        {['administrator', 'super_admin'].includes(role ?? '') && (
          <>
            <SectionLabel text="Nositeľné zariadenia" />
            <NavItem href="/admin/wearables" label="Platformy a monitoring" icon={<Watch size={16} />} />
          </>
        )}

        <SectionLabel text="Dohľad" />
        {['administrator', 'super_admin'].includes(role ?? '') && (
          <>
            <NavItem href="/admin/health" label="Stav integrácií" icon={<HeartPulse size={16} />} />
            <NavItem href="/admin/audit" label="Audit log" icon={<ScrollText size={16} />} />
          </>
        )}
        {role === 'super_admin' && (
          <NavItem href="/admin/users" label="Používatelia" icon={<Users size={16} />} />
        )}

        <SectionLabel text="Nástroje" />
        <NavItem href="/admin/tools" label="Export / Import" icon={<Wrench size={16} />} />
      </div>

      {/* Footer */}
      <div style={{ padding: '.75rem .6rem', borderTop: '1px solid rgba(255,255,255,.07)' }}>
        <Link
          href="/"
          target="_blank"
          style={{
            display: 'flex', alignItems: 'center', gap: '.5rem',
            fontSize: '.82rem', color: 'rgba(255,255,255,.5)', textDecoration: 'none',
            padding: '.4rem .75rem', borderRadius: 6, marginBottom: '.3rem',
          }}
        >
          <ExternalLink size={14} />
          Zobraziť web
        </Link>
        <button
          onClick={logout}
          style={{
            display: 'flex', alignItems: 'center', gap: '.5rem', width: '100%',
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '.82rem', color: 'rgba(255,255,255,.5)',
            padding: '.4rem .75rem', borderRadius: 6,
          }}
        >
          <LogOut size={14} />
          <span>Odhlásiť</span>
          {email && <span style={{ marginLeft: 'auto', fontSize: '.7rem', opacity: 0.5 }}>{email.split('@')[0]}</span>}
        </button>
        {role && (
          <div style={{ padding: '0 .75rem', fontSize: '.68rem', color: 'rgba(255,255,255,.25)' }}>
            Rola: {role}
          </div>
        )}
      </div>
    </aside>
  );
}
