#!/usr/bin/env node
/**
 * CMS-1 verification — boots Strapi programmatically against a scratch SQLite
 * DB and proves three things that had never been exercised:
 *
 *   1. i18n is live: every content type that declares
 *      pluginOptions.i18n.localized=true is reported localized by Strapi and
 *      carries a `locale` attribute (the `pluginsOptions` typo made every
 *      collection single-locale — see docs/03-AUDIT.md CMS-1).
 *   2. The translation review publish gate (src/index.js) actually fires:
 *      a cs department starts as a draft with review_status=needs_review,
 *      publishing it throws, approving then publishing succeeds, and an sk
 *      entry publishes without review.
 *   3. A Rusyn locale (`rue`, absent from Strapi 4.25's ISO list) can be
 *      registered through the locales *service* — the path src/index.js's
 *      bootstrap uses — even though the admin controller's yup schema would
 *      reject it.
 *
 * Usage (from apps/cms, Node 18–22):
 *   APP_KEYS=a,b ADMIN_JWT_SECRET=x API_TOKEN_SALT=x TRANSFER_TOKEN_SALT=x \
 *   SQLITE_PATH=.tmp/verify-i18n.db node scripts/verify-i18n-gate.js
 *
 * Exit 0 = all assertions passed. Scratch DB is deleted on exit.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const appDir = path.resolve(__dirname, '..');
const dbPath = path.resolve(appDir, process.env.SQLITE_PATH || '.tmp/verify-i18n.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
for (const f of [dbPath, `${dbPath}-journal`, `${dbPath}-wal`, `${dbPath}-shm`]) fs.rmSync(f, { force: true });
process.env.SQLITE_PATH = dbPath;
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const results = [];
function ok(name, detail = '') { results.push(['PASS', name, detail]); }
function fail(name, detail = '') { results.push(['FAIL', name, detail]); }

(async () => {
  const strapiFactory = require('@strapi/strapi');
  const strapi = await strapiFactory({ appDir, distDir: appDir, autoReload: false, serveAdminPanel: false }).load();
  try {
    // ── 1. i18n live on every declared content type ──────────────────────
    const declared = [];
    for (const uid of Object.keys(strapi.contentTypes)) {
      if (!uid.startsWith('api::')) continue;
      const ct = strapi.contentTypes[uid];
      const wants = ct.pluginOptions?.i18n?.localized === true;
      const hasLocaleAttr = Boolean(ct.attributes?.locale);
      const localizedFields = Object.entries(ct.attributes)
        .filter(([, a]) => a?.pluginOptions?.i18n?.localized === true)
        .map(([k]) => k);
      declared.push({ uid, wants, hasLocaleAttr, localizedFields });
    }
    const missing = declared.filter((d) => d.wants && !d.hasLocaleAttr);
    const total = declared.filter((d) => d.wants).length;
    if (missing.length) fail('i18n live on all declared content types', missing.map((m) => m.uid).join(', '));
    else ok('i18n live on all declared content types', `${total}/${declared.length} api content types localized, each with a locale attribute`);
    console.log('\nLocalized content types (after fix):');
    for (const d of declared) console.log(`  ${d.wants ? 'LOCALIZED  ' : 'single     '} ${d.uid.padEnd(48)} ${d.localizedFields.length} localized field(s)`);

    // Locales seeded by src/index.js bootstrap
    const localeSvc = strapi.plugin('i18n').service('locales');
    const es = strapi.entityService;
    const codes = (await localeSvc.find()).map((l) => l.code).sort();
    assert.deepEqual(codes, ['cs', 'en', 'hu', 'pl', 'sk', 'uk'].sort());
    ok('bootstrap created the 6 locales', codes.join(','));
    const def = await localeSvc.getDefaultLocale();
    assert.equal(def, 'sk', `default locale must be sk (plugin seeds en; config defaultLocale is inert), got ${def}`);
    ok('default locale is sk', 'plugin seeds en on first boot; bootstrap overrides');
    const noLocale = await es.create('api::history-milestone.history-milestone', { data: { year: '1901', text: 'default-locale probe' } });
    assert.equal(noLocale.locale, 'sk');
    ok('entry created without a locale lands in sk');

    // ── 2. Publish gate fires ────────────────────────────────────────────
    const UID = 'api::department.department';
    const dept = (name, slug) => ({ name, short: name, slug, lead: 'MUDr. Test', leadRole: 'Primár', beds: 1, summary: 's', desc: 'd' });
    const sk = await es.create(UID, { data: { ...dept('Gate test SK', 'gate-test-sk'), locale: 'sk' } });
    const skPub = await es.update(UID, sk.id, { data: { publishedAt: new Date().toISOString() } });
    assert.ok(skPub.publishedAt, 'sk should publish without review');
    ok('sk (human-authored) publishes without review');

    const cs = await es.create(UID, { data: { ...dept('Gate test CS', 'gate-test-cs'), locale: 'cs', publishedAt: new Date().toISOString() } });
    assert.equal(cs.publishedAt, null, 'beforeCreate must force draft');
    assert.equal(cs.review_status, 'needs_review');
    ok('cs entry forced to draft with review_status=needs_review on create');

    let threw = null;
    try { await es.update(UID, cs.id, { data: { publishedAt: new Date().toISOString() } }); }
    catch (e) { threw = e; }
    assert.ok(threw && /review_status='approved'/.test(threw.message), `publish of unreviewed cs must throw, got: ${threw && threw.message}`);
    ok('publishing unreviewed cs entry is BLOCKED', threw.message.slice(0, 80) + '…');
    const still = await es.findOne(UID, cs.id);
    assert.equal(still.publishedAt, null);
    ok('blocked publish left the entry as a draft');

    await es.update(UID, cs.id, { data: { review_status: 'approved', reviewed_by: 'verify-script' } });
    const csPub = await es.update(UID, cs.id, { data: { publishedAt: new Date().toISOString() } });
    assert.ok(csPub.publishedAt);
    ok('approved cs entry publishes');

    // Non-clinical localized collection passes through (gate is per collection)
    const NC = 'api::history-milestone.history-milestone';
    const hm = await es.create(NC, { data: { year: '1900', text: 'x', locale: 'cs', publishedAt: new Date().toISOString() } }).catch((e) => e);
    if (hm instanceof Error) fail('non-clinical cs entry passes through gate', hm.message);
    else { assert.ok(hm.publishedAt); ok('non-clinical cs entry passes through gate (history-milestone)'); }

    // ── 3. Rusyn via the service path ────────────────────────────────────
    const rue = await localeSvc.create({ code: 'rue', name: 'Русиньскый' });
    assert.equal(rue.code, 'rue');
    assert.ok(await localeSvc.findByCode('rue'));
    ok('rue (Rusyn) locale registers via locales service', 'admin-UI path would reject: not in Strapi 4.25 ISO list');
    const rueEntry = await es.create(UID, { data: { ...dept('Gate test RUE', 'gate-test-rue'), locale: 'rue' } });
    assert.equal(rueEntry.locale, 'rue');
    ok('content can be created in locale rue');
  } catch (e) {
    fail('unexpected error', e.stack || String(e));
  } finally {
    await strapi.destroy();
    for (const f of [dbPath, `${dbPath}-journal`, `${dbPath}-wal`, `${dbPath}-shm`]) fs.rmSync(f, { force: true });
  }
  console.log('\nCMS-1 verification:');
  for (const [s, n, d] of results) console.log(`  ${s}  ${n}${d ? `  — ${d}` : ''}`);
  const failed = results.filter((r) => r[0] === 'FAIL').length;
  console.log(failed ? `\n${failed} FAILED` : '\nall passed');
  process.exit(failed ? 1 : 0);
})();
