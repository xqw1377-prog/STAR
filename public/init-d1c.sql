-- D1-B remaining: refcount + interpretation context.

CREATE TABLE IF NOT EXISTS "blob_refcount_event" (
  "id" text PRIMARY KEY NOT NULL,
  "blob_key" text NOT NULL,
  "event_type" text NOT NULL,
  "delta" integer NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  CHECK ("event_type" IN ('ADD', 'REMOVE', 'RECONCILE'))
);

CREATE TABLE IF NOT EXISTS "interpretation_context" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "as_of" timestamp with time zone NOT NULL,
  "mode" text NOT NULL,
  "contract_artifact_id" text NOT NULL,
  "rule_artifact_id" text NOT NULL,
  "source_priority_artifact_id" text NOT NULL,
  "eligibility_policy_artifact_id" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  CHECK ("mode" IN ('HISTORICAL', 'REINTERPRET')),
  FOREIGN KEY ("contract_artifact_id") REFERENCES "artifact_registry"("id"),
  FOREIGN KEY ("rule_artifact_id") REFERENCES "artifact_registry"("id"),
  FOREIGN KEY ("source_priority_artifact_id") REFERENCES "artifact_registry"("id"),
  FOREIGN KEY ("eligibility_policy_artifact_id") REFERENCES "artifact_registry"("id")
);

CREATE TABLE IF NOT EXISTS "interpretation_context_fact" (
  "context_id" text NOT NULL,
  "fact_id" text NOT NULL,
  PRIMARY KEY ("context_id", "fact_id"),
  FOREIGN KEY ("context_id") REFERENCES "interpretation_context"("id"),
  FOREIGN KEY ("fact_id") REFERENCES "normalized_fact"("id")
);

CREATE TABLE IF NOT EXISTS "interpretation_context_parser" (
  "context_id" text NOT NULL,
  "source_id" text NOT NULL,
  "method_id" text NOT NULL,
  "parser_id" text NOT NULL,
  "fact_kind" text NOT NULL,
  "parser_artifact_id" text NOT NULL,
  PRIMARY KEY ("context_id", "source_id", "method_id", "parser_id", "fact_kind"),
  FOREIGN KEY ("context_id") REFERENCES "interpretation_context"("id"),
  FOREIGN KEY ("parser_artifact_id") REFERENCES "artifact_registry"("id")
);
