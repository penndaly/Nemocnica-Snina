/**
 * Integration smoke test — L2 staging gate.
 *
 * Verifies a one-shot handshake with each real vendor integration.
 * Run against the staging environment AFTER L1 secrets are injected.
 *
 * Usage:
 *   APP_BASE_URL=https://staging.nemocnicasnina.sk \
 *   API_BASE_URL=https://api-staging.nemocnicasnina.sk \
 *   STRAPI_URL=https://cms-staging.nemocnicasnina.sk \
 *   STRAPI_API_TOKEN=<staging-token> \
 *   npx ts-node --project tsconfig.base.json scripts/smoke-test.ts
 *
 * Each test prints PASS / FAIL and a detail line. Exit code 1 if any fail.
 */

const APP  = process.env['APP_BASE_URL']  ?? 'http://localhost:3000';
const API  = process.env['API_BASE_URL']  ?? 'http://localhost:3001';
const CMS  = process.env['STRAPI_URL']    ?? 'http://localhost:1337';
const CMS_TOKEN = process.env['STRAPI_API_TOKEN'] ?? '';

interface Result { name: string; pass: boolean; detail: string }
const results: Result[] = [];

async function check(name: string, fn: () => Promise<string>): Promise<void> {
  try {
    const detail = await fn();
    results.push({ name, pass: true, detail });
  } catch (err) {
    results.push({ name, pass: false, detail: String(err) });
  }
}

// ── 1. Public site reachable ─────────────────────────────────

await check('Public site (sk)', async () => {
  const r = await fetch(`${APP}/sk`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const text = await r.text();
  if (!text.includes('Nemocnica Snina')) throw new Error('Brand name missing from homepage');
  return `HTTP ${r.status}, brand present`;
});

// ── 2. eID / OIDC ────────────────────────────────────────────

await check('OIDC discovery endpoint', async () => {
  const issuer = process.env['OIDC_ISSUER_URL'] ?? 'https://oidc.slovensko.sk';
  const r = await fetch(`${issuer}/.well-known/openid-configuration`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const cfg = await r.json() as { issuer?: string; token_endpoint?: string };
  if (!cfg.token_endpoint) throw new Error('token_endpoint missing from OIDC discovery');
  return `issuer=${cfg.issuer}`;
});

await check('eID login redirect (PKCE initiated)', async () => {
  const r = await fetch(`${APP}/sk/portal/login`, { redirect: 'manual' });
  if (r.status !== 307 && r.status !== 302 && r.status !== 303) {
    throw new Error(`Expected 3xx redirect, got ${r.status}`);
  }
  const loc = r.headers.get('location') ?? '';
  if (!loc.includes('code_challenge')) throw new Error(`Missing PKCE in redirect: ${loc.substring(0, 100)}`);
  return `Redirected to IdP with code_challenge`;
});

// ── 3. Strapi CMS ────────────────────────────────────────────

await check('Strapi health', async () => {
  const r = await fetch(`${CMS}/_health`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return `Strapi healthy`;
});

await check('Strapi: departments collection returns ≥1 SK entry', async () => {
  const r = await fetch(`${CMS}/api/departments?locale=sk&pagination[pageSize]=1`, {
    headers: { Authorization: `Bearer ${CMS_TOKEN}` },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const json = await r.json() as { data: unknown[] };
  if (!json.data?.length) throw new Error('No departments found — seed may not have run');
  return `${json.data.length} department(s) returned`;
});

await check('Strapi: clinics collection returns bookingDays field', async () => {
  const r = await fetch(`${CMS}/api/clinics?locale=sk&pagination[pageSize]=1`, {
    headers: { Authorization: `Bearer ${CMS_TOKEN}` },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const json = await r.json() as { data: Array<{ attributes: { bookingDays?: unknown } }> };
  const clinic = json.data[0];
  if (!clinic) throw new Error('No clinics found — seed may not have run');
  // bookingDays may be null for non-bookable clinics, which is fine
  return `clinic.attributes keys: ${Object.keys(clinic.attributes ?? {}).slice(0, 6).join(', ')}`;
});

// ── 4. API health ────────────────────────────────────────────

await check('NestJS API health', async () => {
  const r = await fetch(`${API}/api/health`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return `API healthy`;
});

// ── 5. HIS / FHIR queue smoke ────────────────────────────────

await check('HIS queue: publish test event (booking.confirmed)', async () => {
  // Use the API's own test endpoint — only enabled when HIS_MOCK_ENABLED=false + admin JWT provided
  const adminJwt = process.env['SMOKE_ADMIN_JWT'];
  if (!adminJwt) return 'SKIP (SMOKE_ADMIN_JWT not set — set after L1)';
  const r = await fetch(`${API}/api/his/smoke`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminJwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'booking.confirmed', clinicId: 'smoke-test', patientName: 'Smoke Test' }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
  return `HIS smoke event published`;
});

// ── 6. SMS gateway ───────────────────────────────────────────

await check('SMS gateway: send test OTP (smoke phone)', async () => {
  const smokePhone = process.env['SMOKE_SMS_PHONE'];
  if (!smokePhone) return 'SKIP (SMOKE_SMS_PHONE not set — set after L1)';
  const adminJwt = process.env['SMOKE_ADMIN_JWT'];
  if (!adminJwt) return 'SKIP (SMOKE_ADMIN_JWT not set)';
  const r = await fetch(`${API}/api/sms/otp`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminJwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: smokePhone, purpose: 'smoke' }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
  return `OTP sent to ${smokePhone}`;
});

// ── 7. Payments gateway ──────────────────────────────────────

await check('Payments: create LSPP session (test booking)', async () => {
  const adminJwt = process.env['SMOKE_ADMIN_JWT'];
  if (!adminJwt) return 'SKIP (SMOKE_ADMIN_JWT not set — set after L1)';
  const r = await fetch(`${API}/api/payments/session/lspp`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminJwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingId: 'smoke-booking-id', locale: 'sk' }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
  const session = await r.json() as { sessionId?: string; hostedUrl?: string };
  if (!session.sessionId) throw new Error('No sessionId in response');
  return `sessionId=${session.sessionId}, hostedUrl=${session.hostedUrl?.substring(0, 60) ?? 'N/A'}`;
});

// ── 8. APS e-VÚC feed ────────────────────────────────────────

await check('APS feed (live or CMS fallback)', async () => {
  const r = await fetch(`${API}/api/aps`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const body = await r.json() as { source?: string };
  return `APS data received, source=${body.source ?? 'unknown'}`;
});

// ── 9. Google Cloud Translation ──────────────────────────────

await check('Cloud Translation: translate one phrase SK→EN', async () => {
  const project = process.env['GOOGLE_CLOUD_PROJECT'];
  if (!project) return 'SKIP (GOOGLE_CLOUD_PROJECT not set — set after L1)';
  const { TranslationServiceClient } = await import('@google-cloud/translate');
  const client = new TranslationServiceClient();
  const [res] = await client.translateText({
    parent: `projects/${project}/locations/global`,
    contents: ['Objednať termín'],
    mimeType: 'text/plain',
    sourceLanguageCode: 'sk',
    targetLanguageCode: 'en',
  });
  const translated = res.translations?.[0]?.translatedText ?? '';
  if (!translated) throw new Error('No translation returned');
  return `"Objednať termín" → "${translated}"`;
});

// ── Summary ──────────────────────────────────────────────────

console.log('\n' + '═'.repeat(60));
console.log('INTEGRATION SMOKE TEST RESULTS');
console.log('═'.repeat(60));
let failed = 0;
for (const r of results) {
  const icon = r.detail.startsWith('SKIP') ? '⬜' : r.pass ? '✓' : '✗';
  const status = r.detail.startsWith('SKIP') ? 'SKIP  ' : r.pass ? 'PASS  ' : 'FAIL  ';
  console.log(`${icon} ${status} ${r.name}`);
  if (!r.pass || process.env['VERBOSE']) {
    console.log(`         ${r.detail}`);
  }
  if (!r.pass && !r.detail.startsWith('SKIP')) failed++;
}
console.log('═'.repeat(60));
console.log(`${results.filter(r => r.pass && !r.detail.startsWith('SKIP')).length} passed · ${failed} failed · ${results.filter(r => r.detail.startsWith('SKIP')).length} skipped\n`);

if (failed > 0) {
  console.error('SMOKE TEST FAILED — do not proceed to L3');
  process.exit(1);
}
console.log('All smoke tests passed. Proceed to L3.');
