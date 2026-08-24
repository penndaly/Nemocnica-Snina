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
| `GET /api/health` | 200 `{"status":"ok",...}` |
| `GET /api/admin/health` unauthenticated | 401 (staff guard holds) |
| `scripts/provision-db.sh` on an empty DB | baselines, then "Database schema is up to date!" |
| re-running it | takes the `migrate deploy` path, no-ops |

**Postgres, Redis and RabbitMQ come up healthy. Strapi does not — see
[Known gap: the CMS](#known-gap-the-cms).**

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
   serves the API on the `/api` path of the same hostname, unlike production's
   separate `api.` subdomain.
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
| `STAGING_API_URL` | `https://staging.nemocnicasnina.sk/api` (same host, `/api` path) |
| `STAGING_FIREBASE_*` | the seven `NEXT_PUBLIC_FIREBASE_*` values, if analytics should run on staging |

Until `STAGING_HOST` exists the deploy workflow **skips itself** with a notice
rather than failing, so it is safe to merge now.

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
5. Poll `${STAGING_APP_URL}/sk` until it returns 200, failing the job if it
   never does.

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
  --build-arg NEXT_PUBLIC_API_URL=https://staging.nemocnicasnina.sk/api .

docker compose --env-file infra/.env.staging \
  -f infra/docker-compose.staging.yml up -d

docker compose --env-file infra/.env.staging \
  -f infra/docker-compose.staging.yml cp scripts/provision-db.sh api:/tmp/p.sh
docker compose --env-file infra/.env.staging \
  -f infra/docker-compose.staging.yml exec -T api sh /tmp/p.sh
```

---

## Known gap: the CMS

Strapi sits behind the `cms` compose profile and does **not** start by default,
because it cannot boot: `apps/cms/src/api/*` ships controllers, routes and
services for all nine collections but **no `content-types/<name>/schema.json`**.
`createCoreRouter` therefore has nothing to bind to and Strapi dies with
`Cannot read properties of undefined (reading 'kind')`.

Defining those nine content types is a content-model task (see `DATA_MODEL.md`
and `assets/admin.js` `SCHEMAS`), not an infrastructure one, so it is out of
scope here.

Until it is done, the web app falls back to the bundled `SEED` data exactly as
it does in local dev — `CmsClinicService` logs *"fetch failed, using last
cache/seed"* — so **the demo site is fully browsable without the CMS**. Editing
content through the admin portal writes via the NestJS CMS API, which is what
`/admin` already uses.

Once the content types exist:

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
- `https://<staging>/admin` — admin portal (staff login + MFA)
- `https://<staging>/admin/health` — every integration should read **Mock**,
  and Postgres / Redis / RabbitMQ should read **V poriadku**
