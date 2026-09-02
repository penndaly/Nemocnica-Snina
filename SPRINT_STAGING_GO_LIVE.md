# Sprints — EU Staging Go-Live → Demo Ready
## Nemocnica Snina · picks up from "Sprint: admin health staging complete"

**State (2026-09-02):** `main` green (334 E2E pass / 128 skip / 0 fail). All code items closed. Marketing PR open. Claude Code has `~/.ssh/ns-staging` (ed25519) + `hcloud` CLI ready; blocked on Hetzner API token. DNS for `nemocnicasnina.sk` is on Route 53.

**Run order:** H0 (you, 10 min) → STG-1 → STG-2 → STG-3 → MKT-1 → DEMO-1 → (optional) STG-4. One sprint per Claude Code turn, commit after each, confirm Done-when before the next.

---

## H0 — Human steps (do before pasting STG-1)

1. **Hetzner:** https://console.hetzner.cloud → create account + payment method → Project `ns-staging` → Security → API Tokens → Generate (**Read & Write**). Keep the token in your clipboard; paste it only into the Claude Code chat when STG-1 asks.
2. **Route 53:** have the AWS console open on the `nemocnicasnina.sk` hosted zone. STG-1 will hand you one A record (`staging` → IP, TTL 300) to add. Do **not** hand AWS credentials to Claude Code — one manual record is cheaper and safer.
3. **Firebase:** decision — reuse `apps/web/.env.local` values for staging (default, fine for a mock-mode demo) or create a separate Firebase project. Default: reuse.
4. **GitHub:** confirm `gh auth status` works in the Claude Code terminal with repo-admin scope on `penndaly/Nemocnica-Snina` (needed to set secrets/variables). If not: `gh auth refresh -s admin:repo_hook,repo,workflow`.

---

## STG-1 — Provision + harden the Hetzner host

**Paste into Claude Code:**
```
Sprint STG-1 — provision + harden EU staging host. Read CLAUDE.md, SPRINT_PROD_ADMIN_STAGING.md
Phase 3, and infra/docker-compose.production.yml + any infra/staging* or deploy docs first.

I will paste the Hetzner API token as my next message. Use it ONLY for
`hcloud context create ns-staging` in this session — never write it to disk in the repo, never
echo it, never commit it.

Then:
1. `hcloud server-type list` — pick the current CX-line type closest to 2 vCPU / 4 GB / 40 GB
   (CX22 or successor). Location: fsn1 (fallback nbg1). Image: ubuntu-24.04.
2. Upload ~/.ssh/ns-staging.pub as ssh-key `ns-staging`. Create server `ns-staging-01` with that
   key, label env=staging,project=nemocnica-snina. Create a Hetzner firewall `ns-staging-fw`:
   inbound 22/tcp (my IP only if you can detect it, else 0.0.0.0/0 with fail2ban), 80/tcp,
   443/tcp; everything else denied. Attach to the server.
3. Print the public IPv4 and STOP. Tell me the exact Route 53 record to add:
   `staging.nemocnicasnina.sk  A  <ip>  TTL 300`. Wait for me to confirm it's added, then poll
   `dig +short staging.nemocnicasnina.sk @8.8.8.8` until it resolves (max 10 min).
4. Harden over SSH (ssh -i ~/.ssh/ns-staging root@<ip>): apt update/upgrade; create user
   `deploy` (sudo, docker group, same pubkey); sshd: PasswordAuthentication no, PermitRootLogin
   prohibit-password → then no after deploy user verified; ufw mirror of the Hetzner firewall;
   fail2ban; unattended-upgrades; timezone Europe/Bratislava; install Docker Engine + compose
   plugin from Docker's apt repo; 2 GB swapfile; journald cap 500M.
5. Write infra/staging/README.md documenting: server type, location, IP, firewall rules, users,
   how to rotate the SSH key, how to destroy/recreate. No secrets in it.
6. Commit on branch infra/staging-host and open a PR. Report: IP, hcloud server id, `ssh deploy@
   staging.nemocnicasnina.sk docker --version` output.

Do NOT deploy the app yet — that is STG-2.
```
**Done when:** `ssh -i ~/.ssh/ns-staging deploy@staging.nemocnicasnina.sk docker compose version` works; DNS resolves; root SSH login refused; only 22/80/443 open (`nmap`/`hcloud firewall describe`); `infra/staging/README.md` merged.

---

## STG-2 — Secrets, CI deploy, TLS, first live boot

**Paste into Claude Code:**
```
Sprint STG-2 — deploy main to staging. Read infra/staging/README.md, the deploy workflow under
.github/workflows/ (deploy-staging or equivalent, written in the admin-health sprint), the
.env.staging template/example, and apps/api/src/config/config.schema.ts.

1. Generate .env.staging on the SERVER only (/opt/nemocnica/.env.staging, chmod 600, owner
   deploy). Fill every var: random 64-hex for JWT_SECRET / SESSION_SECRET / ENCRYPTION_KEY /
   STRAPI_* keys / Postgres + RabbitMQ passwords (openssl rand -hex 32). Mock mode stays ON:
   OIDC_MOCK_ENABLED=true, HIS_MOCK_ENABLED=true, TELEHEALTH_PROVIDER=mock, WEARABLES_PROVIDER=mock,
   WEARABLES_ENABLED=false. NODE_ENV=production is NOT allowed here if the validator rejects mocks —
   use NODE_ENV=staging (add it to the schema enum if missing; the production-only refinements must
   NOT fire for staging). MFA_REQUIRED=true stays on. Public URL https://staging.nemocnicasnina.sk.
   Never print secret values; print only the key names you set.
2. GitHub: with `gh secret set` / `gh variable set` on penndaly/Nemocnica-Snina set the values the
   deploy workflow expects (at minimum STAGING_HOST, STAGING_USER=deploy, STAGING_SSH_KEY =
   contents of ~/.ssh/ns-staging, STAGING_FIREBASE_* from apps/web/.env.local (7 fields),
   NEXT_PUBLIC_SITE_URL). List every name you set. Confirm the workflow reads exactly those names.
3. Nginx + TLS: install nginx + certbot on the host; server block for staging.nemocnicasnina.sk →
   web:3000, /api → api:4000, /strapi or /cms → strapi:1337 (match the compose service names);
   HSTS, TLS 1.3 preferred (1.2 min), security headers matching apps/web/next.config.ts. Run
   certbot --nginx with --agree-tos -m <ask me for the email>. Enable the renew timer.
4. Trigger the deploy (`gh workflow run deploy-staging.yml` or push to main). Watch it with
   `gh run watch`. On the host: `docker compose -f docker-compose.production.yml --env-file
   .env.staging ps` — all healthy. Run migrations via DATABASE_MIGRATION_URL, then `make
   db-harden` (audit_log REVOKE + trigger). Seed: the SEED_VERSION 9+ content path (Strapi seed
   or the documented seed script — whichever the admin-health sprint used), NOT real patient data.
5. Live checks, report each with the actual output:
   a. curl -sI https://staging.nemocnicasnina.sk → 200, HSTS present, cert valid (openssl s_client).
   b. https://staging.nemocnicasnina.sk/api/health → ok; /api/admin/health (with a staff token
      obtained via the mock OIDC + TOTP flow) → every integration card in mock mode, infra green.
   c. /sk and /en home render with hero images; /admin login works with the seeded super-admin
      (MFA enrol on first login).
   d. RabbitMQ mgmt NOT publicly reachable (port 15672 closed from outside).
6. Commit any workflow/compose/nginx fixes on infra/staging-deploy, PR, merge. Update
   infra/staging/README.md with the deploy + rollback procedure (`docker compose pull && up -d`
   previous tag).
```
**Done when:** shared URL live on TLS; deploy-on-merge to `main` works end to end; all 4 live checks pass; `/admin/health` all green in mock mode; no secret value appears in any commit, workflow log, or README.

---

## STG-3 — Staging QA + content review vs SEED

**Paste into Claude Code:**
```
Sprint STG-3 — QA the live staging URL. Base: https://staging.nemocnicasnina.sk. Read
design_handoff_nemocnica_snina/E2E_TEST_SPECS.md, assets/data.js (SEED), assets/media.js.

1. Run the Playwright suite against staging: BASE_URL=https://staging.nemocnicasnina.sk pnpm
   test:e2e --project=sk --project=en --project=mobile, using the CI-lane test helpers (mock IdP /
   last-otp / test clock) — confirm they're reachable on staging only via the staging-guarded
   test endpoints, never enabled by a public flag. Report the pass matrix. Fix anything that is
   environmental (URL, cookie domain, secure flag, CORS) — do not skip tests to go green.
2. axe (@axe-core/playwright) on every public route (all 17 pages, sk+en), /portal, /admin
   routes: zero critical/serious. Attach the summary.
3. Content parity: script that pulls every department/clinic/physician/service/facility/news/
   disclosure from the staging API and diffs it against SEED (name, slug, bookable flags,
   bookingDays, hours, phone). Output a table of mismatches; fix by re-seeding, not by hand-editing.
4. Hero/gallery parity: every page in assets/media.js has its hero image served (200, correct
   dimensions, <400 KB, AVIF/WebP with fallback). List any 404s.
5. Lighthouse (mobile + desktop) on /sk, /sk/objednanie, /sk/oddelenia/<one>, /en: Performance
   ≥85, A11y 100, Best Practices ≥95, SEO ≥95. Report numbers; fix quick wins only.
6. Write docs/qa/STAGING_QA_<date>.md with all outputs. Commit, PR, merge.
```
**Done when:** E2E green on staging (sk/en/mobile); axe zero critical/serious on all routes; SEED diff empty; zero hero 404s; Lighthouse thresholds met; QA report merged.

---

## MKT-1 — Merge the marketing-assets PR

**Paste into Claude Code:**
```
Sprint MKT-1 — clear and merge the marketing PR (docs/marketing/, case study + hero images).

1. Leak grep over the PR diff AND all PNG/JPG/AVIF filenames + alt text + EXIF (exiftool) under
   docs/marketing and public/ hero folders:
   - Slovak rodné číslo patterns: \b\d{6}/?\d{3,4}\b
   - phone: (\+421|00421|0)\s?9\d{2}[\s-]?\d{3}[\s-]?\d{3}
   - email: [\w.+-]+@(?!nemocnicasnina\.sk|example\.)[\w-]+\.\w+
   - every physician/staff name from assets/data.js SEED and every patient name from the E2E
     fixtures / seed.ts (extract them programmatically — do not type them)
   - Case-study screenshots: confirm the DOM-masking script ran (spot-check 5 images visually
     with an image viewer or OCR via tesseract if installed).
2. Confirm pixel-perfekt-logo.png usage rights note exists in docs/marketing/README.md; that the
   case study is anonymized as "a regional hospital in eastern Slovakia" consistently in both sk
   and en; no internal URLs (localhost, staging.) in the HTML.
3. Run lint + build. If grep is clean: squash-merge, delete branch. If not: list hits with
   file:line, fix by re-masking/re-capturing, re-run, then merge.
Report the grep command outputs (counts only, no matched values if any are hits).
```
**Done when:** zero grep hits; PR merged; `docs/marketing/` renders both languages with masked screenshots.

---

## DEMO-1 — Demo script, demo accounts, staging reset

**Paste into Claude Code:**
```
Sprint DEMO-1 — make staging demo-proof.

1. Demo accounts (seeded, documented in docs/demo/ACCOUNTS.md — usernames only; passwords/TOTP
   secrets go in a gitignored docs/demo/.secrets.md and 1Password/whatever I use):
   - patient (mock eID persona, has 2 upcoming bookings, 1 lab result, 1 telehealth session,
     1 connected mock wearable with an alert)
   - clinician scoped to FRO clinic; editor (content only); super-admin (MFA enrolled).
2. Staging reset: `pnpm demo:reset` (script + API endpoint guarded by STAGING only + admin JWT)
   that restores SEED content, demo accounts, and demo bookings to a known state in <60 s.
   Cron on the host at 04:00 Europe/Bratislava to run it nightly. Add a "Reset demo data" button
   on /admin/health visible only when APP_ENV=staging.
3. docs/demo/DEMO_SCRIPT.md — 12-minute walkthrough, sk-first with en toggle: home → department →
   book FRO slot (show a rule rejection, e.g. outside bookingDays) → patient portal (results,
   step-up 2FA on PDF) → telehealth join (mock) → wearable alert → admin: content edit + publish
   with translation-draft gate → booking admin → wearables monitoring → audit log → /admin/health.
   Each step: URL, account, what to click, what to say, what proves the non-negotiable.
4. Fallback: `pnpm demo:record` — Playwright script that drives the walkthrough and saves a video
   to docs/demo/ (gitignored, uploaded to a release asset) in case staging is down during the demo.
5. Add uptime ping (e.g. Hetzner/UptimeRobot free tier or a GitHub Actions cron curl) hitting
   / and /api/health every 5 min, notifying me by email on failure. Document in infra/staging.
Commit, PR, merge.
```
**Done when:** four demo accounts log in; reset completes <60 s and nightly; DEMO_SCRIPT walkthrough passes end to end on staging without a single fix-up; fallback video recorded; uptime alert tested by stopping the web container once.

---

## STG-4 (optional, before any external eyes) — Staging backup + basic hardening audit

**Paste into Claude Code:**
```
Sprint STG-4 — staging safety net. On the host: nightly pg_dump of the app + Strapi DBs to
/var/backups/nemocnica (age-encrypted with a key I hold), 7-day rotation, plus weekly copy to
Hetzner Storage Box or object storage in an EU region (ask me to create it). Test one restore into
a scratch Postgres container. Run `docker scout` / trivy on the deployed images; `lynis audit
system`; report critical findings and fix the ones under 30 min. Document in infra/staging/README.md.
```
**Done when:** restore test passes; trivy zero critical on our images; lynis hardening index ≥70.

---

## After this: real launch gate
Staging stays **mock-mode forever**. Real go-live is `design_handoff_nemocnica_snina/LAUNCH_CHECKLIST.md` L1–L9 + `SPRINT_L1_PREP_VENDOR_PROVISIONING.md` D1–D4 (confirm D1–D4 already merged; if not, run it before L1). Don't start it until the contract is won.
