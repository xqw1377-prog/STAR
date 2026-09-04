-- D1 immutable-boundary triggers (append-only whitelist per D0 rev7 FACT_LAYERING §5.1)
-- Excluded BY DESIGN: raw_blob (physical purge is the legal deletion path),
-- collection_plan_item (retired_at lifecycle requires UPDATE),
-- legacy p0 tables (evidence/gates/scores… governed by P0-era code paths).
-- Enforcement is defense-in-depth: repository remains append-only in code;
-- these triggers make the database itself reject UPDATE/DELETE.

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
    'collection_attempt',
    'attempt_outcome_event',
    'attempt_receipt_link',
    'raw_receipt',
    'normalized_fact',
    'receipt_relation',
    'contest_resolution_event',
    'fact_relation',
    'fact_resolution_event',
    'fact_erasure_event',
    'raw_disposition_event',
    'blob_refcount_event',
    'artifact_registry',
    'interpretation_context',
    'interpretation_context_parser',
    'interpretation_context_fact'
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
