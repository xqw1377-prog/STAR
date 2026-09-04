-- D1-B: relations, resolutions, erasure, disposition. Applied after init-d1.sql.

CREATE TABLE IF NOT EXISTS "artifact_registry" (
  "id" text PRIMARY KEY NOT NULL,
  "kind" text NOT NULL,
  "version" text NOT NULL,
  "content_hash" text NOT NULL,
  "content_ref" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  UNIQUE ("kind", "version")
);

CREATE TABLE IF NOT EXISTS "receipt_relation" (
  "id" text PRIMARY KEY NOT NULL,
  "receipt_id" text NOT NULL,
  "related_receipt_id" text NOT NULL,
  "relation" text NOT NULL,
  "basis" text NOT NULL,
  "creator_ref" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  CHECK ("relation" IN ('SUPERSEDES', 'CONTESTS', 'DUPLICATES')),
  FOREIGN KEY ("receipt_id") REFERENCES "raw_receipt"("id"),
  FOREIGN KEY ("related_receipt_id") REFERENCES "raw_receipt"("id")
);

CREATE TABLE IF NOT EXISTS "contest_resolution_event" (
  "id" text PRIMARY KEY NOT NULL,
  "contested_relation" text NOT NULL,
  "basis" text NOT NULL,
  "basis_version" text NOT NULL,
  "resolved_receipt_id" text NOT NULL,
  "authorization_ref" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  CHECK ("basis" IN ('FINALIZED_SLOT', 'SOURCE_PRIORITY', 'MANUAL_AUDIT')),
  FOREIGN KEY ("contested_relation") REFERENCES "receipt_relation"("id"),
  FOREIGN KEY ("resolved_receipt_id") REFERENCES "raw_receipt"("id")
);

CREATE TABLE IF NOT EXISTS "fact_relation" (
  "id" text PRIMARY KEY NOT NULL,
  "fact_a" text NOT NULL,
  "fact_b" text NOT NULL,
  "relation" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  CHECK ("relation" IN ('CONTRADICTS', 'SUPERSEDES', 'TRIGGERS')),
  FOREIGN KEY ("fact_a") REFERENCES "normalized_fact"("id"),
  FOREIGN KEY ("fact_b") REFERENCES "normalized_fact"("id")
);

CREATE TABLE IF NOT EXISTS "fact_resolution_event" (
  "id" text PRIMARY KEY NOT NULL,
  "fact_relation_id" text NOT NULL,
  "basis" text NOT NULL,
  "basis_version" text NOT NULL,
  "resolved_fact_id" text NOT NULL,
  "authorization_ref" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  CHECK ("basis" IN ('SOURCE_PRIORITY', 'MANUAL_AUDIT')),
  FOREIGN KEY ("fact_relation_id") REFERENCES "fact_relation"("id"),
  FOREIGN KEY ("resolved_fact_id") REFERENCES "normalized_fact"("id")
);

CREATE TABLE IF NOT EXISTS "fact_erasure_event" (
  "id" text PRIMARY KEY NOT NULL,
  "fact_id" text NOT NULL,
  "disposition" text NOT NULL,
  "scope" text NOT NULL,
  "authorization_ref" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  CHECK ("disposition" = 'LICENSE_ERASED'),
  FOREIGN KEY ("fact_id") REFERENCES "normalized_fact"("id")
);

CREATE TABLE IF NOT EXISTS "raw_disposition_event" (
  "id" text PRIMARY KEY NOT NULL,
  "receipt_id" text NOT NULL,
  "event_type" text NOT NULL,
  "actor" text NOT NULL,
  "reason" text NOT NULL,
  "authorization_ref" text NOT NULL,
  "scope" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  CHECK ("event_type" IN ('PURGE_REQUESTED', 'PURGE_EXECUTED', 'PURGE_CANCELLED', 'QUARANTINE', 'HOLD', 'RELEASE')),
  CHECK ("scope" IN ('RAW_ONLY', 'LICENSE_ERASURE', 'HOLD', 'NONE')),
  FOREIGN KEY ("receipt_id") REFERENCES "raw_receipt"("id")
);
