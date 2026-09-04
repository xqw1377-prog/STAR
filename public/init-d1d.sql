-- Time-quality + frozen historical bundle. Idempotent ALTERs for existing stores.

ALTER TABLE "collection_attempt" ADD COLUMN IF NOT EXISTS "timing_quality" text NOT NULL DEFAULT 'LIVE';

ALTER TABLE "interpretation_context" ADD COLUMN IF NOT EXISTS "scoring_artifact_id" text;
ALTER TABLE "interpretation_context" ADD COLUMN IF NOT EXISTS "engine_version" text;
ALTER TABLE "interpretation_context" ADD COLUMN IF NOT EXISTS "frozen_bundle" text;
