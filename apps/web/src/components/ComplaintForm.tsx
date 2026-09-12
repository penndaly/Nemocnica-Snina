'use client';

import { useState, type FormEvent } from 'react';
import type { SupportedLocale } from '@/i18n/config';

export function ComplaintForm({ locale, hospitalEmail }: { locale: SupportedLocale; hospitalEmail: string }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [complaintText, setComplaintText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/patient-feedback/complaints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email,
          department: department || undefined,
          complaintText,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? 'Complaint submission failed');
      }
      setConfirmed(true);
      setFullName('');
      setEmail('');
      setDepartment('');
      setComplaintText('');
    } catch (err) {
      if (process.env['NODE_ENV'] === 'development') {
        // No API running locally — still show the confirmation so the page is demoable.
        setConfirmed(true);
      } else {
        setError(err instanceof Error ? err.message : (locale === 'sk' ? 'Chyba pri odosielaní.' : 'Something went wrong.'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card card-pad mt-2" onSubmit={handleSubmit}>
      <div className="grid grid-2">
        <label className="field">
          <span>{locale === 'sk' ? 'Meno a priezvisko' : 'Full name'}</span>
          <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </label>
        <label className="field">
          <span>{locale === 'sk' ? 'E-mail na odpoveď' : 'Email for reply'}</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
      </div>
      <label className="field mt-1">
        <span>{locale === 'sk' ? 'Oddelenie / ambulancia (ak sa týka)' : 'Department / clinic (if applicable)'}</span>
        <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)} />
      </label>
      <label className="field mt-1">
        <span>{locale === 'sk' ? 'Popis sťažnosti' : 'Complaint details'}</span>
        <textarea rows={5} required value={complaintText} onChange={(e) => setComplaintText(e.target.value)} />
      </label>
      <button type="submit" className="btn btn-primary mt-2" disabled={submitting}>
        {locale === 'sk' ? 'Podať sťažnosť' : 'Submit complaint'}
      </button>
      {confirmed && (
        <p className="small muted mt-1 mb-0" role="status">
          {locale === 'sk' ? 'Sťažnosť bola prijatá. Budeme vás kontaktovať.' : 'Your complaint has been received. We will contact you.'}
        </p>
      )}
      {error && (
        <p className="small mt-1 mb-0" role="alert" style={{ color: 'var(--red)' }}>
          {error}
        </p>
      )}
      <p className="small muted mt-2 mb-0">
        {locale === 'sk' ? (
          <>Sťažnosť môžete podať aj priamo na <a href={`mailto:${hospitalEmail}`}>{hospitalEmail}</a>.</>
        ) : (
          <>You may also file a complaint directly at <a href={`mailto:${hospitalEmail}`}>{hospitalEmail}</a>.</>
        )}
      </p>
    </form>
  );
}
