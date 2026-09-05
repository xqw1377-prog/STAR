DO $$ BEGIN CREATE TYPE "public"."alert_level" AS ENUM('CRITICAL', 'HIGH', 'MEDIUM', 'INFO'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."gate_status" AS ENUM('PASS', 'FAIL', 'UNKNOWN', 'PARTIAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "public"."lifecycle" AS ENUM('SEED', 'IGNITION', 'VERIFIED', 'ACCELERATION', 'CROWDING', 'DISTRIBUTION', 'DEAD'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS "chains" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "decisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"conclusion" text NOT NULL,
	"falsification" text,
	"next_review_at" timestamp with time zone,
	"owner" text,
	"updated_at" timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS "entities" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"confidence" real NOT NULL,
	"evidence_summary" text
);

CREATE TABLE IF NOT EXISTS "evidence" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"type" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"ingested_at" timestamp with time zone NOT NULL,
	"source" text NOT NULL,
	"source_url" text,
	"hash" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"conclusion" text,
	"conflict_with" integer
);

CREATE TABLE IF NOT EXISTS "gates" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"rule_version" text DEFAULT 'v1.0' NOT NULL,
	"category" text NOT NULL,
	"status" "gate_status" NOT NULL,
	"reason" text,
	"checked_at" timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS "graph_edges" (
	"source" text NOT NULL,
	"target" text NOT NULL,
	"project_id" text NOT NULL,
	"type" text NOT NULL,
	"evidence" text,
	"confidence" real NOT NULL,
	CONSTRAINT "graph_edges_source_target_type_project_id_pk" PRIMARY KEY("source","target","type","project_id")
);

CREATE TABLE IF NOT EXISTS "narratives" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"stage" "lifecycle" DEFAULT 'SEED' NOT NULL,
	"novelty" real DEFAULT 0 NOT NULL,
	"velocity" real DEFAULT 0 NOT NULL,
	"breadth" real DEFAULT 0 NOT NULL,
	"on_chain_confirm" real DEFAULT 0 NOT NULL,
	"survival" real DEFAULT 0 NOT NULL,
	"discovered_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS "pools" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"dex" text NOT NULL,
	"pair" text NOT NULL,
	"tvl_usd" real,
	"lock_info" jsonb
);

CREATE TABLE IF NOT EXISTS "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"symbol" text NOT NULL,
	"chain_id" text NOT NULL,
	"narrative_id" text NOT NULL,
	"token_mint" text,
	"program_id" text,
	"website" text,
	"github" text,
	"twitter" text,
	"lifecycle" "lifecycle" DEFAULT 'SEED' NOT NULL,
	"decision_readiness" real DEFAULT 0 NOT NULL,
	"discovered_at" timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS "scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"version" text DEFAULT 'v1.0' NOT NULL,
	"narrative" real NOT NULL,
	"team_product" real NOT NULL,
	"capital_holders" real NOT NULL,
	"market_structure" real NOT NULL,
	"lifecycle_fit" real NOT NULL,
	"total" real NOT NULL,
	"confidence" real NOT NULL,
	"freshness" real NOT NULL,
	"computed_at" timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS "shadow_positions" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"entry_at" timestamp with time zone NOT NULL,
	"entry_score" real NOT NULL,
	"simulated_size_usd" real NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"exit_at" timestamp with time zone,
	"exit_reason" text
);

CREATE TABLE IF NOT EXISTS "tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"mint_authority" text,
	"freeze_authority" text,
	"transfer_hook" text,
	"permanent_delegate" text,
	"fee_config" text,
	"verified_build" text,
	"upgrade_authority" text
);

CREATE TABLE IF NOT EXISTS "wallets" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"address" text NOT NULL,
	"entity_id" text NOT NULL,
	"label" text,
	"first_in" timestamp with time zone,
	"balance_usd" real
);

DO $$ BEGIN ALTER TABLE "decisions" ADD CONSTRAINT "decisions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "entities" ADD CONSTRAINT "entities_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "evidence" ADD CONSTRAINT "evidence_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "gates" ADD CONSTRAINT "gates_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "graph_edges" ADD CONSTRAINT "graph_edges_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "pools" ADD CONSTRAINT "pools_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "projects" ADD CONSTRAINT "projects_chain_id_chains_id_fk" FOREIGN KEY ("chain_id") REFERENCES "public"."chains"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "projects" ADD CONSTRAINT "projects_narrative_id_narratives_id_fk" FOREIGN KEY ("narrative_id") REFERENCES "public"."narratives"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "scores" ADD CONSTRAINT "scores_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "shadow_positions" ADD CONSTRAINT "shadow_positions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "tokens" ADD CONSTRAINT "tokens_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "wallets" ADD CONSTRAINT "wallets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;