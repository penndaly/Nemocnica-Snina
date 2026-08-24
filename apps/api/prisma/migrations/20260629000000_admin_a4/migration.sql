-- Sprint A4 — booking no-show status + wearables admin platform/threshold tables

-- 1) Booking NO_SHOW status (admin "mark as no-show"). PG 12+ allows ADD VALUE
--    inside the migration transaction; the value is unused until this commits.
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'NO_SHOW';

-- 2) Platform enable/disable overrides — super_admin toggles in the admin panel.
CREATE TABLE "wearable_platform_overrides" (
    "id"          TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "enabled"     BOOLEAN NOT NULL,
    "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_by"  TEXT NOT NULL,
    CONSTRAINT "wearable_platform_overrides_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "wearable_platform_overrides_platform_id_key"
    ON "wearable_platform_overrides"("platform_id");

-- 3) Global default alert thresholds — fallback below physician per-patient rows.
CREATE TABLE "wearable_global_thresholds" (
    "id"            TEXT NOT NULL,
    "metric_type"   TEXT NOT NULL,
    "critical_low"  DOUBLE PRECISION,
    "critical_high" DOUBLE PRECISION,
    "high_low"      DOUBLE PRECISION,
    "high_high"     DOUBLE PRECISION,
    "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_by"    TEXT NOT NULL,
    CONSTRAINT "wearable_global_thresholds_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "wearable_global_thresholds_metric_type_key"
    ON "wearable_global_thresholds"("metric_type");
