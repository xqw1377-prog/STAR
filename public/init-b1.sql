-- B1 Narrative Event Log (CONSENSUS-OPERATING-MODEL FROZEN-rev1 §1–5, §14).
-- B1 records reality only: no signal, no score, no gate, no decision, no exit.
-- Relation direction is one-way by structure: Event → Narrative → Asset.
-- Append-only: same trigger discipline as D0 rev7 FACT_LAYERING §5.1 —
-- the database itself rejects UPDATE/DELETE; correction = append a new row.

CREATE TABLE IF NOT EXISTS "b1_event" (
  "id" text PRIMARY KEY,
  "event_key" text NOT NULL UNIQUE,
  "label" text NOT NULL,
  "attention" real,
  "observed_at" timestamptz NOT NULL,
  "ingested_at" timestamptz NOT NULL,
  "source_id" text NOT NULL,
  "payload_hash" text NOT NULL,
  "payload" jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS "b1_narrative" (
  "id" text PRIMARY KEY,
  "narrative_key" text NOT NULL UNIQUE,
  "label" text NOT NULL,
  "aliases" jsonb NOT NULL DEFAULT '[]',
  "observed_at" timestamptz NOT NULL,
  "ingested_at" timestamptz NOT NULL,
  "source_id" text NOT NULL,
  "payload_hash" text NOT NULL,
  "payload" jsonb NOT NULL
);

-- One-way edge: event_key → narrative_key. There is no reverse table and no
-- reverse write path; asset→narrative attribution lives in b1_narrative_asset.
CREATE TABLE IF NOT EXISTS "b1_event_narrative_link" (
  "id" text PRIMARY KEY,
  "event_key" text NOT NULL,
  "narrative_key" text NOT NULL,
  "relation" text NOT NULL,
  "observed_at" timestamptz NOT NULL,
  "ingested_at" timestamptz NOT NULL,
  "source_id" text NOT NULL,
  "payload_hash" text NOT NULL,
  "payload" jsonb NOT NULL,
  CONSTRAINT b1_link_unique UNIQUE ("event_key", "narrative_key", "relation")
);

-- Narrative → Asset attribution (cluster membership). An asset is attributed
-- INTO a narrative; a narrative may exist with zero rows here (model §2).
CREATE TABLE IF NOT EXISTS "b1_narrative_asset" (
  "id" text PRIMARY KEY,
  "narrative_key" text NOT NULL,
  "asset_id" text NOT NULL,
  "universe" text NOT NULL,
  "venue" text NOT NULL,
  "attribution_basis" text NOT NULL,
  "observed_at" timestamptz NOT NULL,
  "ingested_at" timestamptz NOT NULL,
  "source_id" text NOT NULL,
  "payload_hash" text NOT NULL,
  "payload" jsonb NOT NULL,
  CONSTRAINT b1_asset_unique UNIQUE ("narrative_key", "asset_id")
);

-- §14 time anchors. Anchors are append-only facts: once observed they are
-- never recomputed or backfilled by inference (model §5 hard rule).
CREATE TABLE IF NOT EXISTS "b1_anchor" (
  "id" text PRIMARY KEY,
  "narrative_key" text NOT NULL,
  "anchor" text NOT NULL,
  "anchored_at" timestamptz NOT NULL,
  "basis" text NOT NULL,
  "source_id" text NOT NULL,
  "observed_at" timestamptz NOT NULL,
  "ingested_at" timestamptz NOT NULL,
  "payload_hash" text NOT NULL,
  "payload" jsonb NOT NULL,
  CONSTRAINT b1_anchor_unique UNIQUE ("narrative_key", "anchor", "anchored_at")
);

CREATE INDEX IF NOT EXISTS "b1_link_narrative_idx" ON "b1_event_narrative_link" ("narrative_key");
CREATE INDEX IF NOT EXISTS "b1_asset_narrative_idx" ON "b1_narrative_asset" ("narrative_key");
CREATE INDEX IF NOT EXISTS "b1_anchor_narrative_idx" ON "b1_anchor" ("narrative_key");

-- Same immutable-boundary function as init-d1-triggers.sql (idempotent, self-sufficient).
CREATE OR REPLACE FUNCTION star_reject_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'star-immutable: % on % is forbidden (append-only ledger; correction = append new row)',
    TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'b1_event',
    'b1_narrative',
    'b1_event_narrative_link',
    'b1_narrative_asset',
    'b1_anchor'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS imm_%s ON %I', t, t);
    EXECUTE format(
      'CREATE TRIGGER imm_%s BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION star_reject_mutation()',
      t, t
    );
  END LOOP;
END;
$$;
