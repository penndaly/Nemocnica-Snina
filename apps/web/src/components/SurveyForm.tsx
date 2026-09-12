'use client';

import { useState, type FormEvent } from 'react';
import type { SupportedLocale } from '@/i18n/config';

/**
 * Anonymous satisfaction survey — no name/email captured, so unlike
 * ComplaintForm this has no consent checkbox and nothing to hold for a
 * DPO sign-off; matches the sprint's own risk framing for this feature.
 */
export function SurveyForm({ locale }: { locale: SupportedLocale }) {
  const [clinicName, setClinicName] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [rating, setRating] = useState('5');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/patient-feedback/survey`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicName,
          visitDate: visitDate || undefined,
          rating: Number(rating),
          comment: comment || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? 'Survey submission failed');
      }
      setConfirmed(true);
      setClinicName('');
      setVisitDate('');
      setRating('5');
      setComment('');
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
          <span>{locale === 'sk' ? 'Oddelenie / ambulancia' : 'Department / clinic'}</span>
          <input type="text" required value={clinicName} onChange={(e) => setClinicName(e.target.value)} />
        </label>
        <label className="field">
          <span>{locale === 'sk' ? 'Dátum návštevy' : 'Visit date'}</span>
          <input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
        </label>
      </div>
      <label className="field mt-1">
        <span>{locale === 'sk' ? 'Celková spokojnosť' : 'Overall satisfaction'}</span>
        <select value={rating} onChange={(e) => setRating(e.target.value)}>
          <option value="5">★★★★★</option>
          <option value="4">★★★★</option>
          <option value="3">★★★</option>
          <option value="2">★★</option>
          <option value="1">★</option>
        </select>
      </label>
      <label className="field mt-1">
        <span>{locale === 'sk' ? 'Komentár (nepovinné)' : 'Comment (optional)'}</span>
        <textarea rows={4} value={comment} onChange={(e) => setComment(e.target.value)} />
      </label>
      <button type="submit" className="btn btn-primary mt-2" disabled={submitting}>
        {locale === 'sk' ? 'Odoslať dotazník' : 'Submit survey'}
      </button>
      {confirmed && (
        <p className="small muted mt-1 mb-0" role="status">
          {locale === 'sk' ? 'Ďakujeme za spätnú väzbu.' : 'Thank you for your feedback.'}
        </p>
      )}
      {error && (
        <p className="small mt-1 mb-0" role="alert" style={{ color: 'var(--red)' }}>
          {error}
        </p>
      )}
    </form>
  );
}
