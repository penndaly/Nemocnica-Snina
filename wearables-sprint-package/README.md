# Wearables & Remote Monitoring — Sprint Package
## Nemocnica Snina

This package contains everything needed to brief Claude Code on the wearables feature
and run the prototype locally. No build step or server is required to view the prototype.

---

## What's in this package

| File | Purpose |
|---|---|
| `README.md` | This file — running instructions + sprint guide |
| `SPRINT_BACKLOG_WEARABLES.md` | 6 paste-ready Claude Code sprints (W1–W6) |
| `wearables-demo-data.js` | Prototype demo data shim — remove in Sprint W4 |
| `portal.html` | Patient portal UI reference — Wearables tab is the target spec |
| `CONTEXT_PROMPT.md` | Paste this into every new Claude Code session |
| `DATA_MODEL.md` | PostgreSQL schema conventions — W1 extends this |
| `TELEMEDICINE_BUILD_GUIDE.md` | HIS queue + FHIR patterns used in W5 |
| `TELEMEDICINE_COMPLIANCE_REVIEW.md` | Compliance gaps + legal blockers — read before W6 |
| `LAUNCH_CHECKLIST.md` | L9 gate — W6 adds wearables items to this |

---

## 1 — View the prototype (no install needed)

The `portal.html` file is a fully self-contained prototype.
Open it directly in any modern browser:

```bash
# macOS
open portal.html

# Windows
start portal.html

# Linux
xdg-open portal.html
```

**Login:** enter anything in the RC and PIN fields — it's a demo.

**Navigate to Wearables:**
1. Log in to the portal
2. Click **Wearables** in the left sidebar (below Lab results)
3. Three demo devices are pre-connected (Abbott FreeStyle Libre 3, Apple Watch, Withings ScanWatch)
4. Click **Connect device** to explore the platform catalog (Medical / Fitness tabs)

> The demo data is loaded from `wearables-demo-data.js`.
> Both files must stay in the same folder — `portal.html` loads it via `<script src="wearables-demo-data.js">`.
> If you move `portal.html` without `wearables-demo-data.js`, the Wearables tab will be blank.

**Switch language:** click SK / EN in the top utility bar.

---

## 2 — Run the full dev environment

> **Prerequisite:** Docker Desktop, Node.js 20+, pnpm 9+.
> Clone the repo first: `git clone git@github.com:penndaly/Nemocnica-Snina.git`

### Apply local fixes (one time, before any sprint)

These fixes were applied during dev setup but are not yet committed to GitHub.
Apply them before starting Sprint W1:

```bash
# 1. Apply the fixes listed in CONTEXT_PROMPT.md §"Local fixes already applied"
#    (auth.service.ts, his-sync.consumer.ts, tsconfig.json, en/sk.json, etc.)

# 2. Commit
git add -A && git commit -m "fix: local dev setup — auth, HIS queue, tsconfig, i18n, SkipLink"
```

### Start infrastructure

```bash
docker compose -f infra/docker-compose.yml up -d
```

Verify all 4 services are healthy:

```bash
docker compose -f infra/docker-compose.yml ps
# Expected: postgres, redis, rabbitmq all "healthy"
```

### Start the API

```bash
cd apps/api
pnpm install      # first time only
pnpm dev
# Listening at http://localhost:4000
# Health check: curl http://localhost:4000/api/health
```

### Start the web app

```bash
cd apps/web
pnpm install      # first time only
pnpm dev
# Listening at http://localhost:3000
```

### Verify everything is running

| Service | URL | Expected response |
|---|---|---|
| Next.js | http://localhost:3000 | Hospital home page |
| NestJS API | http://localhost:4000/api/health | `{"status":"ok"}` |
| RabbitMQ admin | http://localhost:15672 | Management UI (guest/guest in dev) |
| PostgreSQL | localhost:5432 | pg client connects |
| Redis | localhost:6379 | `redis-cli ping` → PONG |

> **Package manager:** always `pnpm`. Never `npm install` or `yarn` in this repo.

---

## 3 — Run a sprint with Claude Code

### Step 1 — Open a new Claude Code session

Start a fresh session in the repo root:

```bash
cd /path/to/Nemocnica-Snina
claude   # or open Claude Code in the repo folder
```

### Step 2 — Paste the context prompt

Copy the entire contents of `CONTEXT_PROMPT.md` and paste it as your first message.
This gives Claude Code the full project context before it writes any code.

### Step 3 — Start the sprint

After the context prompt is acknowledged, paste the sprint-specific prompt from
`SPRINT_BACKLOG_WEARABLES.md`. Each sprint section contains a code-fenced prompt
ready to paste verbatim. Example for W1:

```
Read design_handoff_nemocnica_snina/CONTEXT_PROMPT.md in full before writing any code.
The site is running locally: Next.js on localhost:3000, NestJS API on localhost:4000,
PostgreSQL/Redis/RabbitMQ via Docker.
Read design_handoff_nemocnica_snina/SPRINT_BACKLOG_WEARABLES.md §W1 in full.
Execute Sprint W1 only, then stop and report Done-when criteria.
```

### Step 4 — Verify Done-when criteria

Each sprint ends with a **Done when:** checklist. Confirm every item before
moving to the next sprint. Do not combine sprints or skip ahead.

### Step 5 — Commit

```bash
git add -A && git commit -m "feat(wearables): Sprint W[X] — [brief description]"
```

---

## 4 — Sprint order and dependencies

```
Prerequisite sprints (must be complete before W1):
  S3 — Portal auth + patient JWT pattern    🔴 (provides patient_token)
  S6 — NestJS module pattern + RabbitMQ     🔴 (provides WearablesModule structure)

Wearables sprints:

  W1 — Data model + consent engine
    │   (DB schema, NestJS skeleton, ConsentGuard, config validator)
    │
    ├──> W2 — Medical device adapters        run in parallel after W1
    │         (Abbott Libre, Dexcom, Withings, Omron, 3× cardiac stubs)
    │
    └──> W3 — Consumer platform adapters     run in parallel after W1
              (Apple, Google, Samsung, Fitbit, Garmin, Huawei, Xiaomi, Meta)
                    │
                    └──> W4 — Portal UI (production wiring + demo data removal)
                                    │
                                    └──> W5 — Alerts + HIS FHIR Observations
                                                    │
                                                    └──> W6 — Compliance + E2E + launch gate
```

**W2 and W3 can run simultaneously** in separate Claude Code sessions after W1 is merged.
W4 requires at least one live adapter (recommend Fitbit or Withings) to test the
Connect Device OAuth flow end-to-end.

**Dependency on S10 (telemedicine):** W5 reuses the HIS queue topology from S10.
If S10 is not complete, W5's FHIR export step should be stubbed and revisited.

---

## 5 — Removing the demo data (Sprint W4)

When the production `/api/wearables` endpoint is live, remove the shim:

```bash
# 1. Delete the demo file
rm assets/wearables-demo-data.js

# 2. In portal.html — remove this line:
#    <script src="assets/wearables-demo-data.js"></script>

# 3. Verify the sentinel is gone
#    window.NS_WEARABLES_DEMO should be undefined in the production build

# 4. Commit
git add -A && git commit -m "feat(wearables): remove demo data shim — production API live"
```

The production Next.js portal at `/[lang]/portal/wearables` fetches from the API directly.
`portal.html` is a static prototype reference only after this point.

---

## 6 — Environment variables added by W1

Add these to `apps/api/.env` before starting Sprint W1:

```env
# Wearables module
WEARABLES_ENABLED=false                     # set true only after W6 compliance gate
WEARABLES_PROVIDER=mock                     # mock | live (live rejected unless ENABLED=true)
WEARABLES_TOKEN_KEY=                        # 32-byte hex — generate: openssl rand -hex 32
WEARABLES_OAUTH_REDIRECT_BASE=http://localhost:4000
WEARABLES_GDPR_RETENTION_DAYS=90
WEARABLES_PHYSICIAN_ACCESS_WINDOW_DAYS=90

# Added per-platform in W2 + W3 (leave blank until that sprint):
LIBRE_CLIENT_ID=
LIBRE_CLIENT_SECRET=
LIBRE_REGION=eu
DEXCOM_CLIENT_ID=
DEXCOM_CLIENT_SECRET=
DEXCOM_SANDBOX=true
WITHINGS_CLIENT_ID=
WITHINGS_CLIENT_SECRET=
OMRON_CLIENT_ID=
OMRON_CLIENT_SECRET=
FITBIT_CLIENT_ID=
FITBIT_CLIENT_SECRET=
GARMIN_CONSUMER_KEY=
GARMIN_CONSUMER_SECRET=
GARMIN_WEBHOOK_KEY=
GOOGLE_HEALTH_CLIENT_ID=
GOOGLE_HEALTH_CLIENT_SECRET=
GOOGLE_PROJECT_ID=
GOOGLE_FHIR_DATASET=
GOOGLE_FHIR_STORE=
SAMSUNG_HEALTH_CLIENT_ID=
SAMSUNG_HEALTH_CLIENT_SECRET=
HUAWEI_CLIENT_ID=
HUAWEI_CLIENT_SECRET=
HUAWEI_APP_ID=
APPLE_HEALTH_BUNDLE_ID=
APPLE_TEAM_ID=
```

> **Security:** never commit `.env` to git. It is already in `.gitignore`.

---

## 7 — Partnership agreements required before go-live

Three cardiac implant platforms cannot go live without signed vendor agreements.
Start these conversations in parallel with the build sprints — agreements typically
take 4–8 weeks to execute.

| Platform | Vendor contact | Blocker sprint |
|---|---|---|
| Medtronic MyCareLink (pacemaker) | mycarelink-api@medtronic.com | W2 |
| Abbott Merlin.net (ICD/PM) | cardiovascular.digital@abbott.com | W2 |
| Boston Scientific Latitude NXT | rpmpartner@bsci.com | W2 |
| Meta Ray-Ban (activity only) | Meta Business Partner portal | W3 |

These adapters return `partnership_required: true` until agreements are in place —
the portal shows an "Agreement required" badge rather than an OAuth button.

---

## 8 — Compliance gate (before WEARABLES_ENABLED=true in production)

W6 adds these items to `LAUNCH_CHECKLIST.md §L9`. All must be checked before
flipping `WEARABLES_ENABLED=true` in the production environment:

- [ ] `DPIA_WEARABLES_ADDENDUM.md` signed by DPO
- [ ] `RETENTION.md` wearables section added and DPO approved
- [ ] DPAs in place with each live platform vendor
- [ ] SCCs confirmed for Fitbit (Google/US) and Garmin (US)
- [ ] Huawei blocked until Adequacy Decision or SCCs signed
- [ ] Partnership agreements signed for cardiac implant platforms
- [ ] axe WCAG 2.1 AA — zero critical/serious on all 3 wearables pages
- [ ] E2E tests WR-1 through WR-6 green in CI
- [ ] Pen-test items verified: OAuth CSRF, token isolation, readings isolation,
  webhook signature validation, physician scope enforcement
- [ ] iOS companion app published to App Store (blocks Apple Health live sync)
