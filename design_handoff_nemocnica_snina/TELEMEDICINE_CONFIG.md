# Telemedicine Configuration — Nemocnica Snina

Extends `CONFIG_AND_ENV.md`. All conventions from that document apply. Add these variables to `.env.example` alongside the existing set. All 🔴 secrets go to the vault; never committed.

---

## Accounts to provision (telemedicine additions)

| # | Vendor / service | Used for | Owner | DPA required | Notes |
|---|---|---|---|---|---|
| 15 | **LiveKit** (self-hosted EU or `livekit.io/cloud` EU region) | WebRTC SFU — video signaling + media relay | Ops | **Yes** (cloud) / No (self-hosted) | EU boundary required; TLS enforced; EU-only TURN servers (`LIVEKIT_TURN_REGION=eu`). Cloud option: signed DPA + written confirmation of EU-only TURN before go-live. If US parent company: SCCs required. Self-hosted: add to internal data processing register. |
| 16 | PDF generation service (Gotenberg, self-hosted EU) | Teleconsult summary PDFs | Backend | No (self-hosted) | Self-hosted EU only — no third-party cloud PDF service for health data. Add to internal data processing register. |

---

## `.env.example` additions (telehealth block)

```dotenv
# ───────────────────────── Telehealth / Video ─────────────────────────

# Provider identifier — 'livekit' in production; 'mock' in dev/CI
TELEHEALTH_PROVIDER=mock                                # 🟢

# LiveKit (or equivalent) — only required when TELEHEALTH_PROVIDER=livekit
LIVEKIT_URL=wss://livekit.example.eu                    # 🟢  must be wss:// in production
LIVEKIT_API_KEY=CHANGEME                                # 🔴
LIVEKIT_API_SECRET=CHANGEME                             # 🔴

# TURN server region — restricts ICE candidates to EU-resident TURN relays (GDPR Art. 46)
# For livekit.io cloud: set to the EU region identifier (e.g. 'eu')
# For self-hosted: set to 'self' and confirm the TURN server is in the same EU region as the SFU
# Config validator rejects empty or non-EU region values in production
LIVEKIT_TURN_REGION=eu                                  # 🟢  mandatory; validated in prod

# How long a join token is valid (seconds). Default: 3600 (1 hour).
# Token is issued TELEHEALTH_JOIN_WINDOW_SECONDS before scheduled_at.
TELEHEALTH_SESSION_TTL_SECONDS=3600                     # 🟢
TELEHEALTH_JOIN_WINDOW_SECONDS=600                      # 🟢  10 min before start

# No-show grace period: mark session no_show if patient hasn't joined N minutes after scheduled_at
TELEHEALTH_NO_SHOW_GRACE_MINUTES=15                     # 🟢

# Recording — MUST be false in production unless DPO has explicitly approved
# If set to true, TELEHEALTH_RECORDING_DPO_APPROVED must also be true or the config validator fails
TELEHEALTH_RECORDING_ENABLED=false                      # 🟢  default false; Decree 179/2020 + GDPR
TELEHEALTH_RECORDING_DPO_APPROVED=false                 # 🟢  only set true after DPO sign-off

# Summary PDF retention (seconds). After this period, pdf_path files are purged.
# The authoritative record is in HIS; this is a short-term portal download cache.
TELEHEALTH_PDF_RETENTION_SECONDS=604800                 # 🟢  7 days

# PDF generation service base URL (Gotenberg or equivalent, self-hosted EU)
PDF_SERVICE_URL=http://localhost:3030                    # 🟢  prod: internal EU endpoint
PDF_SERVICE_API_KEY=CHANGEME                            # 🔴

# RabbitMQ event names (can override defaults)
TELEHEALTH_SESSION_ENDED_ROUTING_KEY=telehealth.session.ended   # 🟢
TELEHEALTH_BOOKING_CONFIRMED_ROUTING_KEY=telehealth.booking.confirmed  # 🟢
```

---

## Production invariants (config validator additions)

Add these checks to the startup config validator alongside the existing production invariants (see `CONFIG_AND_ENV.md`):

| Invariant | Rule |
|---|---|
| `TELEHEALTH_PROVIDER` in production | Must not be `mock` when `NODE_ENV=production` |
| `LIVEKIT_URL` in production | Must start with `wss://` (not `ws://`) |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Must not be `CHANGEME` when `NODE_ENV=production` |
| `LIVEKIT_TURN_REGION` | Must be non-empty in production; must not be a non-EU region identifier (e.g. `us-*`, `ap-*`); fail fast with message: "LIVEKIT_TURN_REGION must be an EU-resident region (GDPR Art. 46 — health data must not transit non-EU TURN servers)" |
| Recording gate | If `TELEHEALTH_RECORDING_ENABLED=true`, then `TELEHEALTH_RECORDING_DPO_APPROVED` must also be `true`; otherwise fail fast with message: "TELEHEALTH_RECORDING_ENABLED=true requires TELEHEALTH_RECORDING_DPO_APPROVED=true (DPO sign-off required)" |
| PDF service | `PDF_SERVICE_URL` must not be localhost when `NODE_ENV=production` |
| `PDF_SERVICE_API_KEY` | Must not be `CHANGEME` in production |

---

## Secret-handling notes

- `LIVEKIT_API_SECRET` is used server-side only to sign join tokens; it never reaches the browser. Rotate it if a join token is suspected to be compromised (also invalidates all active sessions — communicate to on-call before rotating).
- `PDF_SERVICE_API_KEY` authorises the API to call the PDF generation service. Keep it on the same secret rotation schedule as other service-to-service credentials.
- `TELEHEALTH_RECORDING_DPO_APPROVED` is a deliberate `🟢 public/config` flag (not a secret) so that its value is visible in the generated `CONFIG.md` and auditable by the DPO without vault access.

---

## Monitoring additions (for L5)

Add these to the L5 monitoring spec:

| Signal | Alert threshold | Dashboard |
|---|---|---|
| Session join failures (patient) | > 5% of joins in a 5-min window | Telehealth operations |
| Admission latency (waiting → active) | > 5 min p95 | Telehealth operations |
| Post-call HIS sync DLQ depth | > 0 messages | HIS sync (existing dashboard) |
| Summary PDF generation failures | > 2 in 10 min | Telehealth operations |
| LiveKit SFU health endpoint | Uptime check every 30s | Infrastructure |
| TELEHEALTH_RECORDING_ENABLED | Synthetic check: assert `false` in production on every deploy | Security |
