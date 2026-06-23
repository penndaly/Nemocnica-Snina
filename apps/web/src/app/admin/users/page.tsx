'use client';

/**
 * Super Admin — staff user management (Sprint A2, Part G).
 *
 * Cosmetic only: every action is authorised server-side by StaffJwtGuard +
 * StaffRolesGuard on /api/admin/users. The page is visible to super_admin
 * (full control) and administrator (read-only — mutation buttons disabled).
 */
import { useCallback, useEffect, useState } from 'react';
import { UserPlus, MoreVertical, ShieldCheck, RefreshCw, X } from 'lucide-react';
import { AdminAuthProvider, useAdminAuth } from '@/components/admin/AdminAuthContext';
import { AdminShell } from '@/components/admin/AdminShell';
import { showToast } from '@/components/admin/AdminToast';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const PUBLIC = `${API}/api/public`;

type Role = 'super_admin' | 'administrator' | 'clinician' | 'editor';
interface Scope { scope_type: string; scope_target_id: string }
interface StaffUser {
  id: string; name: string; email: string; role: Role; status: 'invited' | 'active' | 'disabled';
  mfaStatus: 'active' | 'pending' | 'reset'; lastLoginAt: string | null; scopes: Scope[];
}

const ROLE_BADGE: Record<Role, { label: string; bg: string; color: string }> = {
  super_admin:   { label: 'Super admin',    bg: 'rgba(192,103,46,.18)', color: '#fdba74' },
  administrator: { label: 'Administrator',  bg: 'rgba(37,99,168,.18)',  color: '#93c5fd' },
  clinician:     { label: 'Clinician',      bg: 'rgba(47,138,100,.18)', color: '#6ee7b7' },
  editor:        { label: 'Editor',         bg: 'rgba(148,163,184,.18)', color: '#cbd5e1' },
};
const STATUS_BADGE: Record<StaffUser['status'], { label: string; color: string }> = {
  active:   { label: '● Active',   color: '#6ee7b7' },
  invited:  { label: '○ Invited',  color: '#93c5fd' },
  disabled: { label: '✕ Disabled', color: '#94a3b8' },
};
const MFA_BADGE: Record<StaffUser['mfaStatus'], { label: string; color: string }> = {
  active:  { label: 'MFA active',  color: '#6ee7b7' },
  pending: { label: 'MFA pending', color: '#fcd34d' },
  reset:   { label: 'MFA reset',   color: '#fca5a5' },
};

const SCOPE_GROUPS: { type: string; label: string; endpoint: string }[] = [
  { type: 'department', label: 'Departments', endpoint: 'departments' },
  { type: 'clinic',     label: 'Clinics',     endpoint: 'clinics' },
  { type: 'physician',  label: 'Physicians',  endpoint: 'physicians' },
  { type: 'facility',   label: 'Diagnostics', endpoint: 'facilities' },
];

function UsersInner() {
  const { token, role } = useAdminAuth();
  const canMutate = role === 'super_admin';
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [editing, setEditing] = useState<StaffUser | 'new' | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const authHeaders = useCallback(
    (): Record<string, string> => (token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }),
    [token],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (search) qs.set('search', search);
      if (roleFilter) qs.set('role', roleFilter);
      const res = await fetch(`${API}/api/admin/users?${qs}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setUsers((await res.json()) as StaffUser[]);
    } catch (e) {
      showToast(`Načítanie zlyhalo: ${String(e)}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, authHeaders]);

  useEffect(() => { void load(); }, [load]);

  async function action(id: string, path: string, label: string) {
    if (!confirm(`${label}?`)) return;
    try {
      const res = await fetch(`${API}/api/admin/users/${id}/${path}`, { method: 'POST', headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast(`${label} — hotovo`);
      setMenuFor(null);
      await load();
    } catch (e) {
      showToast(`${label} zlyhalo: ${String(e)}`, 'error');
    }
  }

  async function disableUser(id: string) {
    if (!confirm('Deaktivovať účet? Všetky relácie budú okamžite zrušené.')) return;
    try {
      const res = await fetch(`${API}/api/admin/users/${id}`, {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify({ status: 'disabled' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast('Účet deaktivovaný');
      setMenuFor(null);
      await load();
    } catch (e) {
      showToast(`Deaktivácia zlyhala: ${String(e)}`, 'error');
    }
  }

  const cellStyle: React.CSSProperties = { padding: '.7rem .9rem', borderBottom: '1px solid rgba(255,255,255,.07)', fontSize: '.9rem' };

  return (
    <div style={{ padding: '1.5rem 2rem', color: '#e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '1.4rem' }}>
          <ShieldCheck size={22} /> Používatelia / Users
        </h1>
        {canMutate && (
          <button onClick={() => setEditing('new')} className="btn"
            style={{ display: 'flex', alignItems: 'center', gap: '.4rem', background: '#2563a8', color: '#fff', border: 0, borderRadius: 8, padding: '.55rem .9rem', cursor: 'pointer' }}>
            <UserPlus size={16} /> Pridať používateľa
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '.6rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Hľadať meno / e-mail…"
          aria-label="Hľadať používateľa"
          style={{ flex: '1 1 240px', padding: '.5rem .7rem', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)', background: '#0f1923', color: '#e2e8f0' }} />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Filtrovať podľa roly"
          style={{ padding: '.5rem .7rem', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)', background: '#0f1923', color: '#e2e8f0' }}>
          <option value="">Všetky roly</option>
          {Object.keys(ROLE_BADGE).map((r) => <option key={r} value={r}>{ROLE_BADGE[r as Role].label}</option>)}
        </select>
        <button onClick={() => void load()} aria-label="Obnoviť" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,.15)', borderRadius: 8, color: '#cbd5e1', padding: '.5rem .7rem', cursor: 'pointer' }}>
          <RefreshCw size={16} />
        </button>
      </div>

      {loading ? (
        <p style={{ color: '#94a3b8' }}>Načítavam…</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'rgba(255,255,255,.03)', borderRadius: 10, overflow: 'hidden' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#94a3b8', fontSize: '.78rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              <th style={cellStyle}>Meno</th><th style={cellStyle}>E-mail</th><th style={cellStyle}>Rola</th>
              <th style={cellStyle}>Stav</th><th style={cellStyle}>MFA</th><th style={cellStyle}>Posl. prihl.</th><th style={cellStyle} />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td style={cellStyle}>{u.name}</td>
                <td style={cellStyle}>{u.email}</td>
                <td style={cellStyle}><span style={{ background: ROLE_BADGE[u.role].bg, color: ROLE_BADGE[u.role].color, padding: '.15rem .5rem', borderRadius: 6, fontSize: '.8rem' }}>{ROLE_BADGE[u.role].label}</span></td>
                <td style={{ ...cellStyle, color: STATUS_BADGE[u.status].color }}>{STATUS_BADGE[u.status].label}</td>
                <td style={{ ...cellStyle, color: MFA_BADGE[u.mfaStatus].color, fontSize: '.8rem' }}>{MFA_BADGE[u.mfaStatus].label}</td>
                <td style={{ ...cellStyle, color: '#94a3b8' }}>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('sk') : '—'}</td>
                <td style={{ ...cellStyle, position: 'relative', textAlign: 'right' }}>
                  {canMutate && (
                    <button aria-label="Akcie" onClick={() => setMenuFor(menuFor === u.id ? null : u.id)} style={{ background: 'transparent', border: 0, color: '#cbd5e1', cursor: 'pointer' }}>
                      <MoreVertical size={18} />
                    </button>
                  )}
                  {menuFor === u.id && (
                    <div style={{ position: 'absolute', right: '.9rem', top: '2.2rem', zIndex: 20, background: '#1a2733', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, minWidth: 220, boxShadow: '0 10px 30px rgba(0,0,0,.5)' }}>
                      {[
                        { label: 'Upraviť používateľa', fn: () => { setEditing(u); setMenuFor(null); } },
                        { label: 'Spravovať prístupy', fn: () => { setEditing(u); setMenuFor(null); } },
                        { label: 'Znova poslať pozvánku', fn: () => void action(u.id, 'invite', 'Pozvánka odoslaná') },
                        { label: 'Obnoviť heslo', fn: () => void action(u.id, 'reset-password', 'Reset hesla odoslaný') },
                        { label: 'Obnoviť MFA', fn: () => void action(u.id, 'reset-mfa', 'MFA obnovené') },
                        { label: 'Zrušiť všetky relácie', fn: () => void action(u.id, 'revoke-sessions', 'Relácie zrušené') },
                      ].map((it) => (
                        <button key={it.label} onClick={it.fn} style={menuItem}>{it.label}</button>
                      ))}
                      <div style={{ borderTop: '1px solid rgba(255,255,255,.1)' }} />
                      <button onClick={() => void disableUser(u.id)} style={{ ...menuItem, color: '#fca5a5' }}>Deaktivovať účet</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && <tr><td style={{ ...cellStyle, color: '#94a3b8' }} colSpan={7}>Žiadni používatelia.</td></tr>}
          </tbody>
        </table>
      )}

      {editing && canMutate && (
        <UserEditor
          user={editing === 'new' ? null : editing}
          authHeaders={authHeaders}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load(); }}
        />
      )}
    </div>
  );
}

const menuItem: React.CSSProperties = { display: 'block', width: '100%', textAlign: 'left', padding: '.55rem .8rem', background: 'transparent', border: 0, color: '#e2e8f0', cursor: 'pointer', fontSize: '.85rem' };

function UserEditor({
  user, authHeaders, onClose, onSaved,
}: {
  user: StaffUser | null;
  authHeaders: () => Record<string, string>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [role, setRole] = useState<Role>(user?.role ?? 'editor');
  const [status, setStatus] = useState(user?.status ?? 'invited');
  const [scopes, setScopes] = useState<Scope[]>(user?.scopes ?? []);
  const [options, setOptions] = useState<Record<string, { id: string; label: string }[]>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all(SCOPE_GROUPS.map(async (g) => {
      try {
        const res = await fetch(`${PUBLIC}/${g.endpoint}?locale=sk`);
        const items = (await res.json()) as { id?: string; slug?: string; name?: Record<string, string>; short?: Record<string, string> }[];
        return [g.type, items.map((it) => ({ id: String(it.id ?? it.slug), label: (it.short ?? it.name)?.sk ?? String(it.id ?? it.slug) }))] as const;
      } catch { return [g.type, []] as const; }
    })).then((entries) => setOptions(Object.fromEntries(entries)));
  }, []);

  function toggleScope(type: string, id: string) {
    setScopes((prev) => prev.some((s) => s.scope_type === type && s.scope_target_id === id)
      ? prev.filter((s) => !(s.scope_type === type && s.scope_target_id === id))
      : [...prev, { scope_type: type, scope_target_id: id }]);
  }

  async function save() {
    setSaving(true);
    try {
      if (!user) {
        const res = await fetch(`${API}/api/admin/users`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ name, email, role, scopes }) });
        if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { message?: string }).message ?? `HTTP ${res.status}`);
        showToast('Používateľ vytvorený — pozvánka odoslaná');
      } else {
        const res = await fetch(`${API}/api/admin/users/${user.id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ name, role, status, scopes }) });
        if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { message?: string }).message ?? `HTTP ${res.status}`);
        showToast('Používateľ uložený');
      }
      onSaved();
    } catch (e) {
      showToast(`Uloženie zlyhalo: ${String(e)}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Editor používateľa" onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', justifyContent: 'flex-end', zIndex: 1000 }}>
      <div style={{ width: 'min(520px, 100%)', height: '100%', overflowY: 'auto', background: '#111c27', padding: '1.5rem', color: '#e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.15rem' }}>{user ? 'Upraviť používateľa' : 'Nový používateľ'}</h2>
          <button onClick={onClose} aria-label="Zavrieť" style={{ background: 'transparent', border: 0, color: '#cbd5e1', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <label style={lbl}>Meno<input value={name} onChange={(e) => setName(e.target.value)} style={inp} /></label>
        <label style={lbl}>E-mail<input type="email" value={email} disabled={!!user && user.status !== 'invited'} onChange={(e) => setEmail(e.target.value)} style={inp} /></label>
        <label style={lbl}>Rola
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} style={inp}>
            {Object.keys(ROLE_BADGE).map((r) => <option key={r} value={r}>{ROLE_BADGE[r as Role].label}</option>)}
          </select>
        </label>
        {user && (
          <label style={lbl}>Stav
            <select value={status} onChange={(e) => setStatus(e.target.value as StaffUser['status'])} style={inp}>
              <option value="active">Active</option><option value="disabled">Disabled</option>
            </select>
          </label>
        )}

        <p style={{ marginTop: '1.2rem', color: '#94a3b8', fontSize: '.82rem' }}>
          Prístupy: nechajte prázdne pre neobmedzený prístup. Zaškrtnutím obmedzíte používateľa len na vybrané položky.
        </p>
        {SCOPE_GROUPS.map((g) => (
          <fieldset key={g.type} style={{ border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, margin: '.6rem 0', padding: '.6rem .8rem' }}>
            <legend style={{ fontSize: '.8rem', color: '#cbd5e1' }}>{g.label}</legend>
            {(options[g.type] ?? []).map((opt) => (
              <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '.45rem', fontSize: '.85rem', padding: '.15rem 0' }}>
                <input type="checkbox"
                  checked={scopes.some((s) => s.scope_type === g.type && s.scope_target_id === opt.id)}
                  onChange={() => toggleScope(g.type, opt.id)} />
                {opt.label}
              </label>
            ))}
          </fieldset>
        ))}

        <div style={{ display: 'flex', gap: '.6rem', marginTop: '1.2rem' }}>
          <button onClick={() => void save()} disabled={saving} style={{ background: '#2563a8', color: '#fff', border: 0, borderRadius: 8, padding: '.6rem 1.1rem', cursor: 'pointer' }}>
            {saving ? 'Ukladám…' : 'Uložiť používateľa'}
          </button>
          <button onClick={onClose} style={{ background: 'transparent', color: '#cbd5e1', border: '1px solid rgba(255,255,255,.15)', borderRadius: 8, padding: '.6rem 1.1rem', cursor: 'pointer' }}>Zrušiť</button>
        </div>
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = { display: 'block', fontSize: '.82rem', color: '#cbd5e1', marginBottom: '.7rem' };
const inp: React.CSSProperties = { display: 'block', width: '100%', marginTop: '.25rem', padding: '.5rem .7rem', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)', background: '#0f1923', color: '#e2e8f0' };

export default function UsersPage() {
  return (
    <AdminAuthProvider>
      <AdminShell>
        <UsersInner />
      </AdminShell>
    </AdminAuthProvider>
  );
}
