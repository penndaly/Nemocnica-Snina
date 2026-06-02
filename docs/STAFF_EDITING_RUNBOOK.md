# Staff Editing Runbook — Nemocnica Snina CMS

**For:** Hospital communications staff, medical secretaries, HR.
**CMS URL:** `https://cms.nemocnicasnina.sk/admin` (staging: `https://cms-staging.nemocnicasnina.sk/admin`)

---

## 1. First login and MFA setup

1. Open the CMS admin URL in your browser.
2. Enter your email address and temporary password (provided by IT).
3. You will be prompted to set up **two-factor authentication (MFA)**. This is mandatory.
4. Open an authenticator app (Google Authenticator, Authy, or similar) and scan the QR code shown.
5. Enter the 6-digit code from the app to confirm setup.
6. On every future login, enter your password and then the current 6-digit code from your authenticator app.

> **Important:** Keep your authenticator app on your phone. If you lose access, contact IT to reset your MFA.

---

## 2. Navigating the CMS

After login, you see the **Content Manager** in the left sidebar. The collections you can edit are:

| Collection | What it controls |
|---|---|
| **Departments** (`Oddelenia`) | Inpatient ward pages (name, head physician, beds, visiting hours) |
| **Clinics** (`Ambulancie`) | Outpatient clinic pages AND booking rules (see §4 — read carefully) |
| **Physicians** (`Lekári`) | Physician directory (name, role, bio, accepting status, languages) |
| **Services** (`Služby`) | Services & clinical practices page |
| **Facilities** (`Diagnostika`) | Diagnostics & support facilities |
| **News Items** (`Aktuality`) | News & announcements |
| **Disclosures** (`Zverejňovanie`) | Public contracts & invoices (attach PDFs) |
| **Settings → Hospital Info** | Phone numbers, address, emergency contacts |
| **Settings → Page Content** | Hero section, About text, APS note, GDPR/accessibility statements |

---

## 3. Editing content (Slovak — the source language)

1. Click the collection in the sidebar (e.g. **Departments**).
2. Click the row you want to edit.
3. Make your changes in the form fields.
4. Click **Save** (top right) to save without publishing, or **Publish** to make it live on the website.

> The website updates within 60 seconds of publishing (or immediately via webhook).

**Bilingual content (SK/EN):** Some fields show a locale selector in the top-right corner. Select **sk** for Slovak, **en** for English. Each locale is saved separately. Always edit SK first; SK is the authoritative source.

---

## 4. Booking rules — CRITICAL — read before editing clinic records

The online booking system reads clinic records **directly from this CMS**. Errors here cause real patients to be unable to book, or to book on wrong days.

For each clinic, verify these fields match the physical schedule:

| Field | Meaning | Example |
|---|---|---|
| `bookingDays` | Days appointments are accepted. Numbers: Mon=1, Tue=2, Wed=3, Thu=4, Fri=5. | Trauma surgery: `[2,4]` = Tuesday + Thursday |
| `bookingWindow` | Time window for bookings. Format: `HH:MM–HH:MM`. Leave blank if full day. | Angiology: `13:00–14:00` |
| `bookable` | Toggle online booking on/off for this clinic. | Uncheck for clinics not using online booking |
| `status` | `open` (normal), `new` (just opened), `alert` (temporary changes), `closed` (permanently closed). `alert` and `closed` block online booking. | Use `alert` during staff leave |
| `referral` | If checked, patients must confirm they have a referral (výmenný lístok). | Angiology: checked |

**Before changing any booking rule, confirm with the clinic's secretary that the new rules reflect the actual appointment schedule.** Incorrect rules cannot be corrected until the next CMS publish cycle.

---

## 5. Uploading images and PDF attachments

**Department photos:** Open a department, scroll to the **Image** field, click **+Add media** → Upload your file. Supported: JPG, PNG, WebP. Recommended size: 1600 × 900 px (16:9).

**Disclosure PDFs (contracts & invoices):** Open a Disclosure record, scroll to the **PDF** field, click **+Add media** → Upload the PDF. Only PDF files are accepted.

After uploading, click **Save** and then **Publish**.

---

## 6. Machine-translated content (cs/pl/hu/uk) — human review required

Translations into Czech, Polish, Hungarian, and Ukrainian are produced by machine translation. **These entries arrive in the CMS as DRAFT status with a "Needs Review" indicator.**

**You must review and approve every machine-translated entry before it is published.** Clinical content (department descriptions, clinic names, service descriptions) must be reviewed by a clinician or medical secretary fluent in that language.

To review a translated entry:
1. In the locale selector (top-right of the editor), switch to the target locale (e.g. `cs`).
2. Read the translation carefully. Correct any errors.
3. Pay special attention to: diagnosis names, drug names, specialty names, department names, booking-rule descriptions.
4. If the translation is correct, click **Publish**.
5. If you are unsure, leave it as Draft and contact the translation reviewer.

**Never publish machine-translated clinical content without reading it.** Patient safety depends on accurate information.

---

## 7. Adding a news item

1. Click **News Items** → **+ Add new entry**.
2. Fill in: **Date** (today), **Type** (`good` = green badge, `info` = blue, `alert` = amber warning), **Tag** (e.g. "Oznam"), **Title**, **Body**.
3. Select locale **sk** and fill in Slovak text.
4. Click **Publish**.
5. If you also have an English version, switch locale to **en** and repeat.

---

## 8. Updating contact information

1. Go to **Settings → Hospital Info**.
2. Edit the relevant field (phone, address, etc.).
3. Click **Save**. There is no draft/publish step for settings — changes are live immediately.

---

## 9. Updating the GDPR or Accessibility statement

1. Go to **Settings → Page Content**.
2. Edit the **GDPR Body** or **Accessibility Body** rich-text field.
3. The Accessibility statement should be updated after each formal accessibility audit. Include the audit date and the result.
4. Click **Save**.

---

## 10. Who to contact

| Issue | Contact |
|---|---|
| Can't log in / lost MFA | IT support |
| Booking rules incorrect on the live site | IT / web developer — check CMS publish status first |
| Translation quality issues | Designated language reviewer for that locale |
| PDF upload errors (file too large) | IT — maximum file size is 10 MB; compress larger PDFs |
| Content not updating after 5 minutes | IT / web developer — check webhook status |
