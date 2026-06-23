/**
 * cmsApi — typed client for the NestJS public read API (/api/public).
 *
 * This is the production replacement for the prototype's DB.list/DB.find
 * (localStorage). It targets the NestJS public API ({NEXT_PUBLIC_API_URL}/api/public
 * — NEXT_PUBLIC_API_URL is the shared API origin used across the app), threads
 * the active locale, and uses Next.js ISR (revalidate 60s; news 30s).
 * A non-2xx response throws so Next.js renders error.tsx / notFound().
 *
 * Server components that already use strapi-client.ts (SSR + seed fallback)
 * keep using it; cmsApi is for callers that should go through the canonical API
 * (client components, route handlers, non-web consumers).
 */
import type {
  Department, Clinic, Physician, PhysicianProfile, Service, Facility,
  NewsItem, Disclosure, Hospital, Pages, Locale,
} from '@ns/types';

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const BASE = `${API_ORIGIN.replace(/\/$/, '')}/api/public`;

async function fetchPublic<T>(path: string, locale: Locale, revalidate = 60): Promise<T> {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${BASE}${path}${sep}locale=${locale}`, {
    next: { revalidate },
  });
  if (!res.ok) {
    throw new Error(`cmsApi ${path}: HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export const cmsApi = {
  getDepartments: (locale: Locale) => fetchPublic<Department[]>('/departments', locale),
  getDepartment: (slug: string, locale: Locale) =>
    fetchPublic<Department & { physicians: Physician[]; clinics: Clinic[] }>(`/departments/${slug}`, locale),

  getClinics: (locale: Locale) => fetchPublic<Clinic[]>('/clinics', locale),
  getClinic: (slug: string, locale: Locale) =>
    fetchPublic<Clinic & { physicians: Physician[] }>(`/clinics/${slug}`, locale),

  getPhysicians: (locale: Locale) => fetchPublic<Physician[]>('/physicians', locale),
  getPhysician: (slug: string, locale: Locale) =>
    fetchPublic<PhysicianProfile>(`/physicians/${slug}`, locale),

  getServices: (locale: Locale) => fetchPublic<Service[]>('/services', locale),

  getFacilities: (locale: Locale) => fetchPublic<Facility[]>('/facilities', locale),
  getFacility: (slug: string, locale: Locale) =>
    fetchPublic<Facility & { physicians: Physician[] }>(`/facilities/${slug}`, locale),

  getNews: (locale: Locale) => fetchPublic<NewsItem[]>('/news', locale, 30),
  getDisclosures: (locale: Locale) => fetchPublic<Disclosure[]>('/disclosures', locale),

  getHospital: (locale: Locale) => fetchPublic<Hospital>('/hospital', locale),
  getPages: (locale: Locale) => fetchPublic<Pages>('/pages', locale),
};
