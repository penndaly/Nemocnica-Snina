# Data Model — Nemocnica Snina

Derived from `assets/data.js` (`SEED`) and `assets/admin.js` (`SCHEMAS`/`SINGLETONS`). Bilingual fields are objects keyed by locale: `{ sk, en, … }`. In the prototype only `sk`/`en` are populated; extend to `cs, pl, hu, uk` in production. Bilingual **list** fields are `{ sk: string[], en: string[] }`.

The seed file already contains the **complete, real content** for every collection below — use it verbatim to seed the database/CMS.

## Conventions
- `id`: stable slug (auto-generated from the primary bilingual name in the CMS; editable for `disclosures`).
- `loc` = localized string `{sk,en,…}`; `locList` = `{sk:[],en:[],…}`.
- References point to another collection's `id`.

## Collections

### departments  (inpatient wards) — 7 records
| field | type | notes |
|---|---|---|
| id | slug | e.g. `chirurgia`, `interne` |
| name | loc | full name |
| short | loc | nav/card name |
| lead | string | head physician |
| leadRole | loc | e.g. "Primár" / "Head of Department" |
| deputy | string? | optional |
| deputyRole | loc? | optional |
| beds | number | 0 = outpatient-only (FRO) |
| phone | string? | |
| email | string? | |
| delivery | string? | gynecology delivery-room line |
| featured | bool | show on home |
| summary | loc | card text |
| desc | loc | detail text |
| facilities | locList | bullet list |
| visiting | loc | visiting hours |

### clinics  (outpatient ambulancie) — 8 records
| field | type | notes |
|---|---|---|
| id | slug | |
| name | loc | |
| specialty | loc | |
| doctor | string? | one or more names; absent for `comingSoon` clinics |
| nurse | string? | |
| location | loc | building/floor |
| phone | string? | |
| status | enum | `open` \| `new` \| `alert` \| `closed` \| `comingSoon` |
| bookable | bool | drives online-booking availability |
| referral | bool | requires výmenný lístok |
| acceptingNew | bool? | new clinics accepting patients |
| bookingDays | number[]? | allowed weekdays, **Mon=1 … Sun=0** |
| bookingWindow | string? | e.g. `13:00–14:00` (Angiology) |
| schedule | locList | display hours |
| bookingRule | loc | human-readable rule shown in UI |
| fee | loc? | e.g. LSPP €1.99 |
| opened | date? | launch date |

**Encoded business rules (must persist):** Trauma surgery `bookingDays:[2,4]`; Angiology `bookingDays:[4,5]` + `bookingWindow` + `referral:true`; Diabetology `status:closed`/`bookable:false`; Ortopedická/Kardiologická `status:comingSoon`/`bookable:false` (no `doctor` yet); General surgery 24/7 APS + fee.

### physicians — 15 records
| field | type | notes |
|---|---|---|
| id | slug | |
| name | string | incl. titles (MUDr., MBA…) |
| role | loc | position / specialty |
| bio | loc | |
| accepting | bool | accepting new patients |
| dept | ref→departments? | |
| clinic | ref→clinics? | |
| facility | ref→facilities? | |
| langs | string[] | spoken languages, e.g. `["SK","EN"]` (key for border region) |

### services  (clinical practices) — 8 records
| field | type | notes |
|---|---|---|
| id | slug | |
| name | loc | |
| desc | loc | |
| icon | enum-ish | icon key (scalpel, heart, activity, stethoscope, pulse, shield, flask, scan, pill) |
| dept / clinic / facility | ref? | contextual link target |

### facilities  (SVaLZ / support) — 4 records
| field | type | notes |
|---|---|---|
| id | slug | `lab`, `rdg`, `recepcia`, `lekaren` |
| name | loc | |
| lead | string? | |
| phone | string? | |
| kind | loc | sub-label |
| desc | loc | |
| features | locList | |

### news — 5 records
| field | type | notes |
|---|---|---|
| id | slug | |
| date | date | |
| type | enum | `good` \| `info` \| `alert` (controls badge colour) |
| tag | loc | badge label |
| title | loc | |
| body | loc | |

### disclosures  (contracts & invoices) — 6 records
| field | type | notes |
|---|---|---|
| id | string | document number (editable, used as key) |
| type | loc | "Zmluva"/"Contract" or "Faktúra"/"Invoice" |
| partner | string | partner / subject |
| value | string | amount or "—" |
| date | date | |
| (production) | file | attach the actual PDF |

## Singletons

### hospital (institution info)
`name` (string) · `tagline` (loc) · `address` (string) · `ico` (string) · `dic` (string) · `phone` (string) · `reception` (string) · `pharmacy` (string) · `email` (string) · `region` (loc)

### pages (editable page content blocks)
- `hero`: `badge` (loc), `title` (loc), `subtitle` (loc)
- `about`: `title` (loc), `body` (loc)
- `aps`: `title` (loc), `note` (loc) — back this with the live e-VÚC APS feed in production

## Patient (portal) — demo data only
`patient`: profile (`name,id,dob,blood,insurance`) + `conditions[]` (FHIR Condition: date, ICD-10 `code`, `dx` loc, status, doctor) + `meds[]` (FHIR MedicationRequest: name, `dose` loc, refills) + `labs[]` (FHIR Observation: `test` loc, `result` loc, `flag`, `dept` loc) + `appointments[]`. **Do not seed real patient data** — wire to HIS/FHIR with authenticated access.

## Relationships
- physicians → departments / clinics / facilities (many-to-one, optional)
- services → departments / clinics / facilities (contextual link)
- clinics carry their own scheduling rules (no separate availability table in the prototype; production needs an availability/slots table + booking table referencing `clinic.id`)
