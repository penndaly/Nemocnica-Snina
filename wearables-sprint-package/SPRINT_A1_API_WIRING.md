# Sprint A1 — CMS Content Types, NestJS API & Physician Profiles
## Nemocnica Snina · Admin Backend Production Wiring

**Branch:** `feature/admin-a1-api-wiring`
**Depends on:** S3 (portal auth + patient JWT) · S6 (NestJS module pattern)
**Design prototype:** `admin.html` · `assets/admin.js` (SCHEMAS + SINGLETONS) · `assets/data.js` (SEED shapes)
**Physician directory:** `lekari.html` · `oddelenie.html` · `ambulancie.html`

---

## Paste this into Claude Code before starting

```
Read the following files in full before writing any code:

1. admin.html (full CMS shell — all collections, field types, list/editor views)
2. assets/admin.js (SCHEMAS + SINGLETONS — these are the exact Strapi content-type definitions)
3. assets/data.js (SEED — real hospital data, exact field shapes, bilingual structure)
4. assets/site.js (public site rendering — understand how it reads DB.list/find)
5. lekari.html (physician directory page)
6. oddelenie.html (department detail — shows linked physicians)
7. ambulancie.html (clinics listing)
8. PRODUCTION_ARCHITECTURE.md (stack — Next.js 15 + Strapi 4 + NestJS + Prisma)
9. DATA_MODEL.md (existing schema conventions)

Execute Sprint A1 only. Stop and report Done-when criteria before starting A2.
```

---

## Non-negotiables

- All bilingual fields are stored as `{ sk: string, en: string }` — Strapi JSON field, never two separate text fields.
- Slug / ID generation matches `ADMIN.slugify()` in `assets/admin.js` exactly (NFD normalise → strip diacritics → lowercase → non-alphanum → hyphen → max 28 chars).
- `bookingDays` stored as `integer[]` (PostgreSQL array); `bookingWindow` as `varchar(11)`.
- Physician `name` is a single plain-text field (not bilingual) — contains titles, e.g. `MUDr. Jana Borščová`.
- `SEED_VERSION = 8` from `assets/data.js` is the canonical seed. Strapi seed script must produce identical content to the localStorage prototype.
- Machine-translated languages (CS/PL/HU/UK) are **always draft** on clinical collections. A lifecycle hook blocks `publish` if `review_status !== 'approved'` for those locales. (Full gate implemented in A3; stub the hook now.)
- Never expose patient RC or staff passwords in API responses.
- All API routes under `/api/cms/` require a valid staff JWT (implemented in A2; stub with a dev bypass flag `CMS_AUTH_BYPASS=true` for A1 only — config validator rejects bypass in production).

---

## Part A — Strapi 4 content types

Create the following content types in `apps/cms/` (Strapi 4, plugin format).
Match field names exactly to `SCHEMA.fields[].k` values in `assets/admin.js`.

### A1.1 — Collection types

#### `department` (uid: `api::department.department`)

| Field | Type | Notes |
|---|---|---|
| `slug` | UID | Auto from `short.sk`; max 28 chars |
| `name` | JSON | `{ sk, en }` bilingual |
| `short` | JSON | `{ sk, en }` bilingual |
| `lead` | String | Plain text |
| `leadRole` | JSON | `{ sk, en }` bilingual |
| `deputy` | String | Plain text |
| `deputyRole` | JSON | `{ sk, en }` bilingual; optional |
| `beds` | Integer | Default 0 |
| `phone` | String | |
| `email` | Email | |
| `delivery` | String | Delivery room phone; optional |
| `featured` | Boolean | Default false |
| `summary` | JSON | `{ sk, en }` bilingual |
| `desc` | JSON | `{ sk, en }` bilingual text |
| `facilities` | JSON | `{ sk: string[], en: string[] }` |
| `visiting` | JSON | `{ sk, en }` bilingual |
| `publishedAt` | DateTime | Strapi draft/publish |

#### `clinic` (uid: `api::clinic.clinic`)

| Field | Type | Notes |
|---|---|---|
| `slug` | UID | Auto from `name.sk` |
| `name` | JSON | `{ sk, en }` |
| `specialty` | JSON | `{ sk, en }` |
| `doctor` | String | Plain text (multiple names, comma-separated) |
| `nurse` | String | Optional |
| `location` | JSON | `{ sk, en }` |
| `phone` | String | |
| `status` | Enumeration | `open` \| `new` \| `alert` \| `closed` |
| `bookable` | Boolean | Default false |
| `referral` | Boolean | Default false |
| `acceptingNew` | Boolean | Default false |
| `bookingDays` | JSON | `number[]` e.g. `[1,4,5]` |
| `bookingWindow` | String | e.g. `13:00–14:00`; nullable |
| `schedule` | JSON | `{ sk: string[], en: string[] }` |
| `bookingRule` | JSON | `{ sk, en }` |
| `fee` | JSON | `{ sk, en }`; nullable |
| `publishedAt` | DateTime | |

#### `physician` (uid: `api::physician.physician`)

| Field | Type | Notes |
|---|---|---|
| `slug` | UID | Auto from `name` |
| `name` | String | Plain text with titles |
| `role` | JSON | `{ sk, en }` |
| `bio` | JSON | `{ sk, en }` |
| `accepting` | Boolean | Default false |
| `dept` | Relation | ManyToOne → `department` |
| `clinic` | Relation | ManyToOne → `clinic`; nullable |
| `facility` | Relation | ManyToOne → `facility`; nullable |
| `langs` | JSON | `string[]` e.g. `["SK","EN"]` |
| `photo` | Media | Single image; nullable |
| `publishedAt` | DateTime | |

#### `service` (uid: `api::service.service`)

| Field | Type | Notes |
|---|---|---|
| `slug` | UID | Auto from `name.sk` |
| `name` | JSON | `{ sk, en }` |
| `desc` | JSON | `{ sk, en }` |
| `icon` | Enumeration | `scalpel\|heart\|activity\|stethoscope\|pulse\|shield\|flask\|scan\|pill` |
| `dept` | Relation | ManyToOne → `department`; nullable |
| `clinic` | Relation | ManyToOne → `clinic`; nullable |
| `facility` | Relation | ManyToOne → `facility`; nullable |
| `publishedAt` | DateTime | |

#### `facility` (uid: `api::facility.facility`)

| Field | Type | Notes |
|---|---|---|
| `slug` | UID | Auto from `name.sk` |
| `name` | JSON | `{ sk, en }` |
| `lead` | String | Optional |
| `phone` | String | Optional |
| `kind` | JSON | `{ sk, en }` |
| `desc` | JSON | `{ sk, en }` |
| `features` | JSON | `{ sk: string[], en: string[] }` |
| `photo` | Media | Single image; nullable |
| `publishedAt` | DateTime | |

#### `news-item` (uid: `api::news-item.news-item`)

| Field | Type | Notes |
|---|---|---|
| `slug` | UID | Auto from `title.sk` |
| `title` | JSON | `{ sk, en }` |
| `body` | JSON | `{ sk, en }` |
| `tag` | JSON | `{ sk, en }` |
| `type` | Enumeration | `good` \| `info` \| `alert` |
| `date` | Date | |
| `publishedAt` | DateTime | |

#### `disclosure` (uid: `api::disclosure.disclosure`)

| Field | Type | Notes |
|---|---|---|
| `docId` | String | **User-provided** document number (e.g. `ZML-2024-051`) — unique, required |
| `type` | JSON | `{ sk, en }` e.g. `{ sk:"Zmluva", en:"Contract" }` |
| `partner` | String | |
| `value` | String | Display string e.g. `45 000 € / rok` |
| `date` | Date | |
| `document` | Media | Single PDF; nullable |
| `publishedAt` | DateTime | |

### A1.2 — Single types (Singletons)

#### `hospital-info` (uid: `api::hospital-info.hospital-info`)
Fields: `name` (String), `tagline` (JSON), `address` (String), `ico` (String), `dic` (String), `phone` (String), `reception` (String), `pharmacy` (String), `emergency` (String), `email` (Email), `region` (JSON).

#### `page-content` (uid: `api::page-content.page-content`)
Nested JSON matching `SEED.pages` exactly:
```json
{
  "hero":  { "badge": { "sk":"", "en":"" }, "title": { "sk":"", "en":"" }, "subtitle": { "sk":"", "en":"" } },
  "about": { "title": { "sk":"", "en":"" }, "body":  { "sk":"", "en":"" } },
  "aps":   { "title": { "sk":"", "en":"" }, "note":  { "sk":"", "en":"" } }
}
```
Store as a single `content` JSON field.

---

## Part B — Strapi seed script

```typescript
// apps/cms/seed/seed.ts
// Seeds all collections from SEED in assets/data.js.
// Run: pnpm --filter cms seed
// Idempotent: checks docId / slug uniqueness before inserting.
// Must produce identical content to SEED_VERSION=8.

// Order: hospital-info → facilities → departments → clinics → physicians → services → news → disclosures → page-content
// Reason: physicians reference departments, clinics, facilities; services reference all three.
```

---

## Part C — NestJS CMS API (`apps/api/src/cms/`)

```typescript
// Module: CmsModule
// All routes prefixed: /api/cms/
// All routes: CmsAuthGuard (validates staff JWT — bypass with CMS_AUTH_BYPASS=true in dev only)
// Config validator rejects CMS_AUTH_BYPASS=true in production

// ---- Collections (full CRUD) ----
// Pattern: one controller per collection, one service wrapping Strapi REST API

GET    /api/cms/:collection            → list(collection, { locale?, status?, search? })
GET    /api/cms/:collection/:id        → findOne(collection, id)
POST   /api/cms/:collection            → create(collection, dto)
PUT    /api/cms/:collection/:id        → update(collection, id, dto)
DELETE /api/cms/:collection/:id        → remove(collection, id)

// :collection values: departments | clinics | physicians | services | facilities | news | disclosures

// ---- Singletons ----
GET    /api/cms/singletons/hospital    → getHospitalInfo()
PUT    /api/cms/singletons/hospital    → updateHospitalInfo(dto)
GET    /api/cms/singletons/pages       → getPageContent()
PUT    /api/cms/singletons/pages       → updatePageContent(dto)

// ---- Slug helper ----
GET    /api/cms/slug?text=:text        → { slug: string }
// Returns slugified string matching ADMIN.slugify() — used by admin UI before save

// ---- Media upload ----
POST   /api/cms/media                  → uploadMedia(file: Express.Multer.File)
// Proxies to Strapi upload; returns { id, url, mime }
// Accepted: image/jpeg, image/png, image/webp, application/pdf
// Max size: images 10 MB; PDFs 50 MB
```

### DTOs — bilingual validation
```typescript
// Shared validators used across all DTOs:
class BilingualDto {
  @IsString() sk: string;
  @IsString() en: string;
}
class BilingualListDto {
  @IsArray() @IsString({ each: true }) sk: string[];
  @IsArray() @IsString({ each: true }) en: string[];
}

// All Create/Update DTOs extend these. Validation enforced server-side.
// Client UI validation (admin.html) is cosmetic only — API must reject bad data.
```

---

## Part D — Public read API (`apps/api/src/public/`)

```typescript
// Module: PublicModule
// Routes: /api/public/
// No auth required — these replace DB.list/find in the prototype public pages.
// SSR in Next.js calls these; results are cached (ISR 60 s) except news (ISR 30 s).

GET /api/public/departments           → published departments array
GET /api/public/departments/:slug     → single department + physicians[] + related clinics[]
GET /api/public/clinics               → published clinics array
GET /api/public/clinics/:slug         → single clinic + physician[]
GET /api/public/physicians            → published physicians array (with dept/clinic populated)
GET /api/public/physicians/:slug      → single physician (full profile)
GET /api/public/services              → published services
GET /api/public/facilities            → published facilities
GET /api/public/facilities/:slug      → single facility + physicians[]
GET /api/public/news                  → published news, date DESC
GET /api/public/disclosures           → published disclosures, date DESC
GET /api/public/hospital              → hospital-info singleton
GET /api/public/pages                 → page-content singleton
```

---

## Part E — Physician profile pages

The prototype (`lekari.html`) links physicians to their department or clinic page but has **no individual physician profile page**. Implement full individual profiles.

### E1 — Public profile endpoint (already in Part D)
```
GET /api/public/physicians/:slug
Returns:
{
  slug, name, role{sk,en}, bio{sk,en}, accepting, langs,
  photo: { url } | null,
  dept: { slug, short{sk,en} } | null,
  clinic: { slug, name{sk,en}, status, bookable } | null,
  facility: { slug, name{sk,en} } | null
}
```

### E2 — Next.js physician profile page
```
Path: apps/web/src/app/[lang]/lekari/[slug]/page.tsx
SSR: getPhysician(slug) — 404 if not found or not published.

Layout:
┌──────────────────────────────────────────────────────┐
│  [Avatar / photo]  MUDr. Jana Borščová               │
│                    Primárka · Interné oddelenie       │
│                    ● Accepting new patients            │
│                    [SK] [EN]  (language chips)        │
├──────────────────────────────────────────────────────┤
│  Bio (bilingual body text)                           │
├──────────────────────────────────────────────────────┤
│  [Card] Department → /oddelenia/interne              │
│  or                                                  │
│  [Card] Clinic     → /ambulancie#urologicka          │
├──────────────────────────────────────────────────────┤
│  [Button] Book appointment (if clinic.bookable)      │
│  [Button] Back to physician directory                │
└──────────────────────────────────────────────────────┘
- Avatar: initials circle (same as lekari.html) if no photo; photo if uploaded.
- "Accepting" badge: green with dot (same as directory).
- Language chips: same .lang-tag style from styles.css.
- Breadcrumb: Home / Physicians / MUDr. Jana Borščová
- generateStaticParams: pre-render all published physician slugs.
- generateMetadata: name + role as title; bio excerpt as description.
```

### E3 — Update lekari.html card links
```
In lekari.html (prototype, for reference — Next.js is the production target):
  Change card href from oddelenie.html?id=X to lekari/[slug]
  This gives each physician a canonical URL for sharing and SEO.

In Next.js:
  apps/web/src/app/[lang]/lekari/page.tsx — directory
  apps/web/src/app/[lang]/lekari/[slug]/page.tsx — profile
```

### E4 — Physician admin editor enhancement
```
In admin.html (and the production Strapi admin panel in A2):
  Add photo upload field to physician editor.
  Field: <input type="file" accept="image/jpeg,image/png,image/webp">
  On select: POST /api/cms/media → store returned { id, url } as photo relation.
  Preview: 64×64 circle preview of uploaded image, same as avatar.
  Remove: "Remove photo" link → sets photo to null.
```

---

## Part F — Next.js data layer migration

```typescript
// Replace all prototype DB.* calls in Next.js pages with API client functions.
// Create: apps/web/src/lib/cms-api.ts

export const cmsApi = {
  getDepartments: () => fetchPublic('/departments'),
  getDepartment:  (slug) => fetchPublic(`/departments/${slug}`),
  getClinics:     () => fetchPublic('/clinics'),
  getClinic:      (slug) => fetchPublic(`/clinics/${slug}`),
  getPhysicians:  () => fetchPublic('/physicians'),
  getPhysician:   (slug) => fetchPublic(`/physicians/${slug}`),
  getServices:    () => fetchPublic('/services'),
  getFacilities:  () => fetchPublic('/facilities'),
  getFacility:    (slug) => fetchPublic(`/facilities/${slug}`),
  getNews:        () => fetchPublic('/news'),
  getDisclosures: () => fetchPublic('/disclosures'),
  getHospital:    () => fetchPublic('/hospital'),
  getPages:       () => fetchPublic('/pages'),
}

// fetchPublic wraps fetch with:
// - Base URL: process.env.NEXT_PUBLIC_API_URL
// - next: { revalidate: 60 } (ISR)
// - Error boundary: throws on 4xx/5xx; Next.js shows error.tsx
```

---

## Part G — Environment variables added by A1

```env
# Strapi
STRAPI_URL=http://localhost:1337
STRAPI_API_TOKEN=          # read-only token for public API; full-access for CMS API

# Next.js
NEXT_PUBLIC_API_URL=http://localhost:4000/api/public

# NestJS
CMS_AUTH_BYPASS=true       # dev only — rejected in production by config validator
STRAPI_ADMIN_URL=http://localhost:1337
STRAPI_ADMIN_TOKEN=        # full-access Strapi token for NestJS CMS proxy
```

---

## Part H — Tests

```typescript
// Unit tests (cms.service.spec.ts):
// - slugify: "MUDr. Jana Borščová" → "mudr-jana-borscova" (max 28 chars, diacritics stripped)
// - slugify: collision handling → append "-2", "-3"
// - create department: bilingual validation rejects missing .en
// - create disclosure: docId collision → 409 Conflict

// E2E (Playwright):
// A1-1  GET /api/public/departments → returns array matching SEED departments (7 items).
// A1-2  GET /api/public/physicians → accepts returning physician has badge-green in lekari page.
// A1-3  GET /api/public/physicians/borscova → profile page renders name + bio + dept card.
// A1-4  POST /api/cms/departments (valid body, CMS_AUTH_BYPASS=true) → 201 + slug generated.
// A1-5  POST /api/cms/departments (missing en in name) → 422 Unprocessable Entity.
// A1-6  PUT /api/cms/clinics/urologicka (status: "closed") → clinic page shows Closed badge.
// A1-7  axe: zero critical/serious on /[lang]/lekari and /[lang]/lekari/borscova.
```

---

## Done when

- [ ] All 7 Strapi collection types created and matching `assets/admin.js` SCHEMAS exactly
- [ ] Strapi seed (idempotent) produces content identical to `SEED_VERSION=8`
- [ ] NestJS CMS API: full CRUD for all 7 collections + 2 singletons
- [ ] NestJS Public API: all read endpoints returning published content
- [ ] `CMS_AUTH_BYPASS=true` accepted in dev; config validator rejects in production
- [ ] Physician profile page: `/[lang]/lekari/[slug]` renders full profile (SSR, 404 if not found)
- [ ] `generateStaticParams` pre-renders all published physicians
- [ ] Photo upload in physician editor (admin.html prototype + Strapi media)
- [ ] `cmsApi` client replaces `DB.*` calls in Next.js pages
- [ ] A1-1 through A1-7 green
- [ ] axe: zero critical/serious on physician directory and profile pages
