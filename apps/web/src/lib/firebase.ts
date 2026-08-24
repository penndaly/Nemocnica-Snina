import { getApps, getApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';

/**
 * Analytics only. Do not add Firestore, Auth or Storage here — patient,
 * booking and portal data stay on the EU-hosted Postgres/NestJS/Strapi stack
 * (Decree 179/2020, see CLAUDE.md). No patient identifiers may be sent to
 * Firebase, including as analytics event params.
 */
const measurementId = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  ...(measurementId ? { measurementId } : {}),
};

/** Idempotent across HMR and Next's dual server/client module graphs. */
export function getFirebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

/**
 * Browser-only, and drops a Google cookie — so it is opt-in rather than
 * initialised at import time. Call it after the visitor accepts analytics
 * cookies. Returns null on the server or where analytics is unsupported.
 */
export async function initFirebaseAnalytics(): Promise<Analytics | null> {
  if (typeof window === 'undefined') return null;
  if (!(await isSupported())) return null;
  return getAnalytics(getFirebaseApp());
}
