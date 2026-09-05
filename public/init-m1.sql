-- M1 Chain Observation (Acquisition Matrix V1, M1; principal authorization 2026-09-05).
-- Replayable, verifiable, recoverable, accountable chain observation layer.
-- Outputs Observations ONLY — never Evidence Truth, never Gate/Score/Decision.
-- Append-only: observation / dead_letter / batch are immutable after commit
-- (same trigger discipline as D1 §5.1). checkpoint (the watermark) and gap
-- (lifecycle status) are the ONLY mutable rows, by design.

CREATE TABLE IF NOT EXISTS "m1_observation" (
  "id" text PRIMARY KEY,
  "observation_key" text NOT NULL UNIQUE,
  "source_id" text NOT NULL,
  "mode" text NOT NULL,
  "slot" integer NOT NULL,
  "signature" text,
  "instruction_index" integer,
  "kind" text NOT NULL,
  "raw_hash" text NOT NULL,
  "raw_payload" jsonb NOT NULL,
  "normalized" jsonb NOT NULL,
  "observed_at" timestamptz NOT NULL,
  "ingested_at" timestamptz NOT NULL,
  "batch_id" text NOT NULL
);

CREATE INDEX IF NOT EXISTS "m1_observation_slot_idx" ON "m1_observation" ("slot");
CREATE INDEX IF NOT EXISTS "m1_observation_batch_idx" ON "m1_observation" ("batch_id");

-- Singleton watermark (id = 1): highest fully processed slot. Advanced ONLY
-- inside the same transaction as its batch (observations + dead letters).
CREATE TABLE IF NOT EXISTS "m1_checkpoint" (
  "id" integer PRIMARY KEY,
  "source_id" text NOT NULL,
  "highest_fully_processed_slot" integer NOT NULL,
  "updated_at" timestamptz NOT NULL
);

-- Slot coverage holes. A gap is an explicit record — "not observed" is NEVER
-- silently treated as "observed and confirmed absent".
CREATE TABLE IF NOT EXISTS "m1_gap" (
  "id" text PRIMARY KEY,
  "source_id" text NOT NULL,
  "from_slot" integer NOT NULL,
  "to_slot" integer NOT NULL,
  "detected_at" timestamptz NOT NULL,
  "status" text NOT NULL,
  "backfill_batch_id" text
);

-- Decode/interpret/normalize failures. Full original context preserved so the
-- system can always answer: why did this input never become an Observation?
CREATE TABLE IF NOT EXISTS "m1_dead_letter" (
  "id" text PRIMARY KEY,
  "source_id" text NOT NULL,
  "slot" integer,
  "signature" text,
  "observation_key" text,
  "stage" text NOT NULL,
  "error" text NOT NULL,
  "raw_hash" text,
  "raw_payload" jsonb NOT NULL,
  "first_seen_at" timestamptz NOT NULL,
  "retry_count" integer NOT NULL DEFAULT 0
);

-- One row per committed batch. to_slot == the checkpoint value advanced in
-- the SAME transaction — never ahead of, never behind, the data.
CREATE TABLE IF NOT EXISTS "m1_batch" (
  "id" text PRIMARY KEY,
  "source_id" text NOT NULL,
  "mode" text NOT NULL,
  "from_slot" integer NOT NULL,
  "to_slot" integer NOT NULL,
  "observation_count" integer NOT NULL,
  "dead_letter_count" integer NOT NULL DEFAULT 0,
  "committed_at" timestamptz NOT NULL
);

-- Append-only enforcement (checkpoint and gap are mutable by design).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['m1_observation', 'm1_dead_letter', 'm1_batch']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS imm_m1_%s ON %I', t, t);
    EXECUTE format(
      'CREATE TRIGGER imm_m1_%s BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION star_reject_mutation()',
      t, t
    );
  END LOOP;
END;
$$;
