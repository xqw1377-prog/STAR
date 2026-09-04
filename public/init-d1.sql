-- D1-A implementable subset. Applied on top of init.sql.
-- payload_ref / fact_payload_ref have NO database FK (dangling content handles).

CREATE TABLE IF NOT EXISTS "collection_plan_item" (
  "id" text PRIMARY KEY NOT NULL,
  "source_id" text NOT NULL,
  "method_id" text NOT NULL,
  "subject_project" text NOT NULL,
  "expected_fact_kind" text NOT NULL,
  "plan_version" text NOT NULL,
  "observation_template" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "retired_at" timestamp with time zone,
  UNIQUE ("source_id", "method_id", "subject_project", "expected_fact_kind", "plan_version")
);

CREATE TABLE IF NOT EXISTS "raw_blob" (
  "blob_key" text PRIMARY KEY NOT NULL,
  "payload_hash" text NOT NULL,
  "scope" text NOT NULL,
  "body" text NOT NULL,
  "length" integer NOT NULL,
  "mime" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS "collection_attempt" (
  "id" text PRIMARY KEY NOT NULL,
  "observation_key" text NOT NULL,
  "collection_plan_item_id" text,
  "project_id" text NOT NULL,
  "fact_kind" text NOT NULL,
  "source_id" text NOT NULL,
  "method_id" text NOT NULL,
  "attempt_origin" text NOT NULL,
  "started_at" timestamp with time zone NOT NULL,
  "lease_expires_at" timestamp with time zone NOT NULL,
  "retry_of_attempt_id" text,
  "request_params_sanitized" text NOT NULL DEFAULT '{}',
  "timing_quality" text NOT NULL DEFAULT 'LIVE',
  CHECK ("attempt_origin" IN ('INITIAL', 'RETRY', 'CRASH_REPLAY', 'SCHEDULER_REISSUE')),
  CHECK ("timing_quality" IN ('LIVE', 'BACKFILLED_UNKNOWN'))
);

CREATE TABLE IF NOT EXISTS "attempt_outcome_event" (
  "id" text PRIMARY KEY NOT NULL,
  "attempt_id" text NOT NULL UNIQUE,
  "outcome" text NOT NULL,
  "response_bytes_received" integer NOT NULL,
  "completed_at" timestamp with time zone NOT NULL,
  "error_code" text,
  "error_body_hash" text,
  "error_body_ref" text,
  "retention_class" text NOT NULL DEFAULT 'NONE',
  CHECK ("outcome" IN ('SUCCESS', 'PARTIAL', 'SOURCE_ERROR', 'TRANSPORT_ERROR', 'TIMEOUT', 'ABORTED')),
  FOREIGN KEY ("attempt_id") REFERENCES "collection_attempt"("id")
);

CREATE TABLE IF NOT EXISTS "raw_receipt" (
  "id" text PRIMARY KEY NOT NULL,
  "receipt_key" text NOT NULL UNIQUE,
  "observation_key" text NOT NULL,
  "creator_outcome_event_id" text NOT NULL UNIQUE,
  "status" text NOT NULL,
  "payload_hash" text NOT NULL,
  "payload_ref" text NOT NULL,
  "anchor_slot" integer,
  "anchor_time" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL,
  CHECK ("status" IN ('SUCCESS', 'PARTIAL')),
  CHECK ("anchor_slot" IS NOT NULL OR "anchor_time" IS NOT NULL),
  FOREIGN KEY ("creator_outcome_event_id") REFERENCES "attempt_outcome_event"("id")
);

CREATE TABLE IF NOT EXISTS "attempt_receipt_link" (
  "id" text PRIMARY KEY NOT NULL,
  "outcome_event_id" text NOT NULL UNIQUE,
  "receipt_id" text NOT NULL,
  FOREIGN KEY ("outcome_event_id") REFERENCES "attempt_outcome_event"("id"),
  FOREIGN KEY ("receipt_id") REFERENCES "raw_receipt"("id")
);

CREATE TABLE IF NOT EXISTS "normalized_fact" (
  "id" text PRIMARY KEY NOT NULL,
  "receipt_id" text NOT NULL,
  "fact_kind" text NOT NULL,
  "subject_type" text NOT NULL,
  "subject_id" text NOT NULL,
  "payload_hash" text NOT NULL,
  "fact_payload_ref" text NOT NULL,
  "parser_version" text NOT NULL,
  "fact_local_key" text NOT NULL DEFAULT 'singleton',
  "effective_time_kind" text NOT NULL DEFAULT 'OBSERVATION_BOUND',
  "created_at" timestamp with time zone NOT NULL,
  UNIQUE ("receipt_id", "fact_kind", "subject_type", "subject_id", "parser_version", "fact_local_key"),
  FOREIGN KEY ("receipt_id") REFERENCES "raw_receipt"("id")
);
