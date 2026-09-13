# EU staging / demo deployment

A shared, clickable URL that always reflects `main`, so the platform can be
demonstrated without anyone's laptop.

> **This is a demo environment, not the go-live target.**
> It runs every integration in mock mode (eID/OIDC, HIS/eZdravie, SMS,
> payments, machine translation, telemedicine, wearables). It is deliberately
> **not** hardened to the production non-negotiables, and it must **never hold
> real patient data**. Going live with real patients and real vendor
> credentials is the separate L1–L9 launch gate in `LAUNCH_CHECKLIST.md`.

---

## Interim: public-site preview on Firebase App Hosting (2026-09-13)

Because no staging host exists, the **web app alone** is deployed to the
existing Firebase project `snina-nemocnica` (App Hosting, `europe-west4`,
EU) so the site can be seen:

**https://nemocnica-snina-web--snina-nemocnica.europe-west4.hosted.app**

- Config: `firebase.json` (backend `nemocnica-snina-web`, `rootDir:
  apps/web`), `.firebaserc`, `apps/web/apphosting.yaml`. Deploy from the
  repo root: `npx -y firebase-tools@latest deploy --only apphosting`.
  Not wired to CI — deploys are manual and deliberate.
- **No API, CMS, DB or queue behind it.** Content renders from `seed.ts`
  (`STRAPI_API_TOKEN` unset → `USE_FALLBACK`). Booking, portal,
  telehealth, wearables and admin do not function. `GET /api/aps` answers
  `x-ns-upstream: fallback`, which is the same header the STG-3 gate
  would reject on a real deploy — correct here, because there is no API.
- Photos: the preview renders the bundled placeholder photography
  (`apps/web/public/img`, MEDIA-1); there is no CMS, so the admin
  replace/hide controls only apply on a deployment with Strapi.
- `JWT_SECRET` is a throwaway value in Secret Manager
  (`ns-web-preview-jwt-secret`) so portal handlers 401 instead of 500.
- Two build-time facts forced by the platform: Firebase's Next.js adapter
  refuses `next@15.1.3` (CVE-2025-55182), so apps/web is on 15.1.12; and
  the buildpack resolves an open `engines.pnpm` range to a pnpm 12 that it
  cannot install, so the range is `>=9 <11` (packageManager pins 9.15.0).
- This is a preview, not the production stack. Everything above this
  section still applies for the real deployment.

---

## What is already in the repo

| Piece | Path |
|---|---|
| API image | `infra/docker/Dockerfile.api` |
| Web image | `infra/docker/Dockerfile.web` |
| Strapi image | `infra/docker/Dockerfile.cms` |
| Staging stack | `infra/docker-compose.staging.yml` |
| Staging edge (nginx) | `infra/nginx/nginx.staging.conf` |
| Env template | `infra/.env.staging.example` |
| DB provisioning | `scripts/provision-db.sh` |
| Deploy on merge to `main` | `.github/workflows/deploy-staging.yml` |

### Verified locally

The whole stack was brought up with these files against local images. Through
nginx with TLS, on a single hostname:

| Request | Result |
|---|---|
| `GET /sk` | 200 (web) |
| `GET /admin` | 200 (admin portal) |
| `GET /api/health` | 200 `{"status":"ok",...}` — **path since STG-3: `/backend/api/health`** |
| `GET /api/admin/health` unauthenticated | 401 (staff guard holds) — now `/backend/api/admin/health` |
| `scripts/provision-db.sh` on an empty DB | baselines, then "Database schema is up to date!" |
| re-running it | takes the `migrate deploy` path, no-ops |

**Postgres, Redis and RabbitMQ come up healthy. Strapi now does too — see
[Known gap: the CMS](#known-gap-the-cms) for what was actually wrong (it
wasn't missing schemas) and what's still open.**

---

## What a human has to create (the one-time step)

Everything above is code and is already done. These four items cannot be
scripted from here because they need an account and a payment method:

1. **An EU-region host.** One small VM is enough (2 vCPU / 4 GB / 40 GB).
   It must be in an EU region — Decree 179/2020 and GDPR Art. 44–49 apply to
   this project even in demo form. Hetzner (Nürnberg/Helsinki), OVH (Gravelines),
   Scaleway (Paris) and UpCloud (Frankfurt) all qualify. Install Docker Engine
   and the Compose plugin.
2. **A DNS record**, e.g. `staging.nemocnicasnina.sk` → the host's IP.
3. **A TLS certificate.** `certbot certonly --standalone -d staging.nemocnicasnina.sk`.

   `TLS_CERT_DIR` is a directory that must contain the two filenames the nginx
   config expects — **`nemocnicasnina.crt` and `nemocnicasnina.key`**, not
   certbot's `fullchain.pem` / `privkey.pem`. Symlink them:

   ```bash
   mkdir -p /srv/ns-tls
   ln -sf /etc/letsencrypt/live/<domain>/fullchain.pem /srv/ns-tls/nemocnicasnina.crt
   ln -sf /etc/letsencrypt/live/<domain>/privkey.pem   /srv/ns-tls/nemocnicasnina.key
   # TLS_CERT_DIR=/srv/ns-tls
   ```

   Only **one** DNS record and **one** certificate are needed: the staging edge
   serves the API on the `/backend` path of the same hostname, unlike
   production's separate `api.` subdomain. (Not `/api`: the Next.js app owns
   `/api/*` route handlers with the same prefixes as the NestJS controllers —
   see the comment in `nginx.staging.conf` and STG-3 in `docs/03-AUDIT.md`.)
4. **An SSH key** for CI to deploy with (`ssh-keygen -t ed25519`), with the
   public half in the host's `~/.ssh/authorized_keys`.

### Then set these in GitHub

**Secrets** (Settings → Secrets and variables → Actions → Secrets)

| Secret | Value |
|---|---|
| `STAGING_HOST` | host IP or DNS name |
| `STAGING_SSH_USER` | SSH user (e.g. `deploy`) |
| `STAGING_SSH_KEY` | the **private** key from step 4 |

**Variables** (same page → Variables)

| Variable | Example |
|---|---|
| `STAGING_APP_URL` | `https://staging.nemocnicasnina.sk` |
| `STAGING_API_URL` | `https://staging.nemocnicasnina.sk/backend` (same host, `/backend` path — nginx strips the prefix; the app appends `/api/…` itself, so this is the API **origin**, never `…/api`) |
| `STAGING_FIREBASE_*` | the seven `NEXT_PUBLIC_FIREBASE_*` values, if analytics should run on staging |

Until `STAGING_HOST` exists the deploy workflow **skips itself** rather than
failing, so it is safe to merge now. **A skipped run still concludes "success"**
— the guard job is the only job that ran. Since STG-3 the guard writes a
warning and a job summary saying *nothing was deployed*; read that, not the
green tick. (Every "Deploy — EU staging" run from 2026-08-24 to 2026-09-12 was
this skip. No host has ever been rolled.)

If `STAGING_HOST` is set but either URL variable is missing, the guard now
**fails** instead of building a web image with an empty `NEXT_PUBLIC_API_URL`.

### And on the host, once

```bash
mkdir -p ~/nemocnica-snina/infra
# copy infra/.env.staging.example -> ~/nemocnica-snina/infra/.env.staging
# then fill in every blank:
openssl rand -base64 32   # POSTGRES_PASSWORD, REDIS_PASSWORD, RABBITMQ_PASSWORD
openssl rand -hex 32      # JWT_SECRET, STAFF_JWT_SECRET, WEARABLES_TOKEN_KEY
```

`infra/.env.staging` lives **only on the host**. CI never writes it, so the
staging credentials never pass through GitHub.

---

## How a deploy runs

On every merge to `main`:

1. Build and push `nemocnica-api`, `nemocnica-web` and `nemocnica-strapi` to
   GHCR, tagged with the commit SHA and `latest`.
2. `scp` the compose file, nginx config and SQL init to the host.
3. `docker compose pull && up -d`, then `prisma migrate deploy`.
4. Run `scripts/provision-db.sh`, which baselines an empty database and
   otherwise runs `migrate deploy` (see the script for why `migrate deploy`
   alone cannot build the schema from scratch).
5. Readiness gate (STG-3, 2026-09-12) — each rung fails the job on its own:
   1. `GET ${STAGING_APP_URL}/sk` → 200 (web).
   2. `GET ${STAGING_API_URL}/api/health` → 200 (API liveness). Before STG-3
      only rung 1 existed, so a rolled host whose API had crashed on boot
      (API-1) would have been reported green.
   3. Smoke, so a booted-but-broken API cannot pass either:
      `GET /api/booking/available-dates` → `GET /api/booking/slots` (a real
      Prisma query: DB URL, migrations and the BookingModule DI graph), and
      `GET ${STAGING_APP_URL}/api/aps` must carry `x-ns-upstream: api`, which
      the Next.js handler sets only when it reached NestJS from inside the
      web container (`API_BASE_URL`).

### The one thing to remember about the web image

`NEXT_PUBLIC_*` values are inlined by Next at **build** time, and they also feed
the CSP `connect-src` in `next.config.ts`. A web image is therefore bound to the
environment it was built for — you cannot re-point it by changing runtime env.
Rebuild per environment. The workflow does this with `--build-arg`.

---

## Manual deploy (no CI)

```bash
docker build -f infra/docker/Dockerfile.api -t nemocnica-api .
docker build -f infra/docker/Dockerfile.web -t nemocnica-web \
  --build-arg NEXT_PUBLIC_API_URL=https://staging.nemocnicasnina.sk/backend .

docker compose --env-file infra/.env.staging \
  -f infra/docker-compose.staging.yml up -d

docker compose --env-file infra/.env.staging \
  -f infra/docker-compose.staging.yml cp scripts/provision-db.sh api:/tmp/p.sh
docker compose --env-file infra/.env.staging \
  -f infra/docker-compose.staging.yml exec -T api sh /tmp/p.sh
```

---

## CMS boot — fixed (2026-08-24)

Strapi sits behind the `cms` compose profile and doesn't start by default, but
it now boots cleanly when the profile is enabled. The "no `content-types/*/schema.json`"
diagnosis in earlier versions of this doc was wrong — all nine `schema.json`
files already existed (and are considerably more complete than `DATA_MODEL.md`/
`assets/admin.js` describe: i18n-localized, real relations, a translation-review
publish gate). The actual boot blocker (`Cannot read properties of undefined
(reading 'kind')` in `createCoreRouter`) was a one-character UID typo —
`apps/cms/src/api/news-item/{routes,controllers,services}/news-item.js` called
`createCoreRouter('api::news-item.newsUitem')` instead of `'api::news-item.news-item'`,
so Strapi's route registration looked up a content-type UID that was never
registered. Fixed, plus a second, separate blocker: `apps/cms/config/admin.js`
(required for `auth.secret`/admin-panel auth) didn't exist at all — added.

Verified by building `infra/docker/Dockerfile.cms` and running it against a
real (empty) Postgres: `strapi start` boots, `GET /admin` → 200, admin
registration + API-token creation works, and `apps/cms/seed/import-seed.ts`
(which had two of its own bugs — a wrong relative import path assuming one
`..` too few, and a `findBySlug` lookup on `disclosures` which has no `slug`
field, only `documentId` — both fixed) successfully seeds all 9 collections/
singletons with content matching `apps/web/src/lib/seed.ts`'s `SEED`.

```bash
docker compose --env-file infra/.env.staging \
  -f infra/docker-compose.staging.yml --profile cms up -d
```

---

## Why staging is not `NODE_ENV=production`

The API config validator (`apps/api/src/config/config.schema.ts`) rejects
`OIDC_MOCK_ENABLED=true`, `HIS_MOCK_ENABLED=true` and `TELEHEALTH_PROVIDER=mock`
whenever `NODE_ENV === 'production'` — those are project non-negotiables and
should stay that way. A mock-mode demo therefore cannot claim to be production,
so the API container runs with `NODE_ENV=development`.

That also relaxes the internal-TLS requirements (`rediss://`, `amqps://`). This
is acceptable **only** because no backing service publishes a port: Postgres,
Redis, RabbitMQ and Strapi are reachable only on the compose-internal network,
and nginx terminates TLS at the edge. It is another reason real patient data
must never land here.

If a production-grade staging environment is wanted later, the clean route is an
explicit `APP_ENV` (`production` | `staging` | `development`) in the config
schema so hardening and mock-rejection can be decided separately — not to weaken
the existing `NODE_ENV === 'production'` checks.

---

## Checking it works

- `https://<staging>/sk` — public site
- `https://<staging>/backend/api/health` — API liveness (what the deploy gate polls)
- `https://<staging>/api/aps` — must respond with `x-ns-upstream: api`
- `https://<staging>/admin` — admin portal (staff login + MFA)
- `https://<staging>/admin/health` — every integration should read **Mock**,
  and Postgres / Redis / RabbitMQ should read **V poriadku**
