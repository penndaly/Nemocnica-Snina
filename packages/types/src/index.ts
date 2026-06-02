// =========================================================
// Nemocnica Snina — Shared TypeScript types
// Derived from DATA_MODEL.md and assets/data.js SEED
// Bilingual fields are Loc<T>; extend locales as needed.
// =========================================================

export type Locale = 'sk' | 'cs' | 'pl' | 'hu' | 'uk' | 'en';

/** Localized string — one value per supported locale */
export type Loc = Partial<Record<Locale, string>>;

/** Localized string array */
export type LocList = Partial<Record<Locale, string[]>>;

// ─── Singletons ──────────────────────────────────────────

export interface Hospital {
  name: string;
  tagline: Loc;
  address: string;
  ico: string;
  dic: string;
  phone: string;
  reception: string;
  pharmacy: string;
  emergency: string;
  email: string;
  region: Loc;
}

export interface Pages {
  hero: {
    badge: Loc;
    title: Loc;
    subtitle: Loc;
  };
  about: {
    title: Loc;
    body: Loc;
  };
  aps: {
    title: Loc;
    note: Loc;
  };
}

// ─── Collections ─────────────────────────────────────────

export interface Department {
  id: string;
  name: Loc;
  short: Loc;
  lead: string;
  leadRole: Loc;
  deputy?: string;
  deputyRole?: Loc;
  beds: number;
  phone?: string;
  email?: string;
  delivery?: string;
  featured: boolean;
  summary: Loc;
  desc: Loc;
  facilities: LocList;
  visiting: Loc;
}

export type ClinicStatus = 'open' | 'new' | 'alert' | 'closed';

/** Mon=1 … Sun=0 to match prototype bookingDays encoding */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Clinic {
  id: string;
  name: Loc;
  specialty: Loc;
  doctor: string;
  nurse?: string;
  location: Loc;
  phone?: string;
  status: ClinicStatus;
  bookable: boolean;
  referral: boolean;
  acceptingNew?: boolean;
  bookingDays?: Weekday[];
  bookingWindow?: string;
  schedule: LocList;
  bookingRule: Loc;
  fee?: Loc;
  opened?: string;
}

export interface Physician {
  id: string;
  name: string;
  role: Loc;
  bio: Loc;
  accepting: boolean;
  dept?: string;
  clinic?: string;
  facility?: string;
  langs: string[];
}

export type ServiceIcon =
  | 'scalpel'
  | 'heart'
  | 'activity'
  | 'stethoscope'
  | 'pulse'
  | 'shield'
  | 'flask'
  | 'scan'
  | 'pill';

export interface Service {
  id: string;
  name: Loc;
  desc: Loc;
  icon: ServiceIcon;
  dept?: string;
  clinic?: string;
  facility?: string;
}

export interface Facility {
  id: string;
  name: Loc;
  lead?: string;
  phone?: string;
  kind: Loc;
  desc: Loc;
  features: LocList;
}

export type NewsType = 'good' | 'info' | 'alert';

export interface NewsItem {
  id: string;
  date: string;
  type: NewsType;
  tag: Loc;
  title: Loc;
  body: Loc;
}

export interface Disclosure {
  id: string;
  type: Loc;
  partner: string;
  value: string;
  date: string;
  pdfUrl?: string;
}

// ─── Operational (PostgreSQL, not CMS) ───────────────────

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface Booking {
  id: string;
  clinicId: string;
  patientName: string;
  patientPhone: string;
  patientRc: string;
  date: string;
  time: string;
  hasReferral: boolean;
  gdprConsent: boolean;
  referralConsent: boolean;
  status: BookingStatus;
  smsToken?: string;
  cancelToken: string;
  createdAt: string;
  updatedAt: string;
}

export interface AvailabilitySlot {
  id: string;
  clinicId: string;
  date: string;
  time: string;
  booked: boolean;
}

export type OnboardingStatus = 'submitted' | 'under_review' | 'accepted' | 'rejected';

export interface OnboardingApplication {
  id: string;
  physicianId: string;
  patientName: string;
  patientRc: string;
  insurerCode: string;
  phone: string;
  email?: string;
  status: OnboardingStatus;
  reviewedBy?: string;
  reviewNote?: string;
  createdAt: string;
  updatedAt: string;
}

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'view'
  | 'login'
  | 'logout'
  | 'booking_confirm'
  | 'booking_cancel'
  | 'onboarding_accept'
  | 'onboarding_reject';

export interface AuditLogEntry {
  id: string;
  actor: string;
  actorRole: string;
  action: AuditAction;
  resource: string;
  resourceId: string;
  detail?: Record<string, unknown>;
  ip?: string;
  createdAt: string;
}

export type StaffRole = 'editor' | 'clinician' | 'admin';

export interface StaffUser {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
  mfaEnabled: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

// ─── FHIR R4 (portal — never stored in our DB) ───────────

export interface FhirCondition {
  id: string;
  date: string;
  code: string;
  dx: Loc;
  status: 'active' | 'resolved' | 'inactive';
  doctor: string;
}

export interface FhirMedicationRequest {
  id: string;
  date: string;
  name: string;
  dose: Loc;
  refills: number;
}

export type LabFlag = 'normal' | 'high' | 'low' | 'critical';

export interface FhirObservation {
  id: string;
  date: string;
  test: Loc;
  result: Loc;
  flag: LabFlag;
  dept: Loc;
}

export interface FhirAppointment {
  id: string;
  date: string;
  time: string;
  clinic: Loc;
  doctor: string;
}

// ─── Full seed shape ──────────────────────────────────────

export interface Seed {
  hospital: Hospital;
  pages: Pages;
  departments: Department[];
  clinics: Clinic[];
  physicians: Physician[];
  services: Service[];
  facilities: Facility[];
  news: NewsItem[];
  disclosures: Disclosure[];
}
