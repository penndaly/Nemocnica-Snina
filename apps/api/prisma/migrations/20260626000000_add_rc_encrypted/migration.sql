-- Add decryptable RC storage for NCZI eDohoda XML generation + GDPR Art. 15 export.
--
-- S1 stored only patient_rc_hash (bcrypt, one-way). The NCZI eDohoda payload and
-- a GDPR access request both need the plaintext RC, which bcrypt cannot recover.
-- This adds an AES-256-GCM ciphertext column (key: RC_ENCRYPTION_KEY). Nullable
-- because existing rows have no recoverable RC to back-fill (bcrypt is one-way) —
-- those pre-fix applications require manual processing.
ALTER TABLE "onboarding_applications" ADD COLUMN "patient_rc_encrypted" TEXT;
