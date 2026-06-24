-- QA security: TOTP single-use (anti-replay) for the staff MFA step.
-- Stores the last accepted TOTP time-step counter so a still-valid code cannot
-- be replayed within its window (verifyMfa rejects counter <= last).
ALTER TABLE "staff_accounts"
  ADD COLUMN IF NOT EXISTS "last_totp_counter" BIGINT;
