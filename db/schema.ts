/* eslint-disable @typescript-eslint/no-explicit-any */
import { pgTable, text, timestamp, real, jsonb, integer, primaryKey, pgEnum, serial } from 'drizzle-orm/pg-core';

export const lifecycle = pgEnum('lifecycle', [
  'SEED', 'IGNITION', 'VERIFIED', 'ACCELERATION', 'CROWDING', 'DISTRIBUTION', 'DEAD',
]);
export const gateStatus = pgEnum('gate_status', ['PASS', 'FAIL', 'UNKNOWN']);
export const alertLevel = pgEnum('alert_level', ['CRITICAL', 'HIGH', 'MEDIUM', 'INFO']);

export const chains = pgTable('chains', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
});

export const narratives = pgTable('narratives', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  stage: lifecycle('stage').notNull().default('SEED'),
  novelty: real('novelty').notNull().default(0),
  velocity: real('velocity').notNull().default(0),
  breadth: real('breadth').notNull().default(0),
  onChainConfirm: real('on_chain_confirm').notNull().default(0),
  survival: real('survival').notNull().default(0),
  discoveredAt: timestamp('discovered_at', { withTimezone: true, mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull(),
  aliases: jsonb('aliases').$type<string[]>().notNull().default([]),
});

export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  symbol: text('symbol').notNull(),
  chainId: text('chain_id').notNull().references(() => chains.id),
  narrativeId: text('narrative_id').notNull().references(() => narratives.id),
  tokenMint: text('token_mint'),
  programId: text('program_id'),
  website: text('website'),
  github: text('github'),
  twitter: text('twitter'),
  lifecycle: lifecycle('lifecycle').notNull().default('SEED'),
  decisionReadiness: real('decision_readiness').notNull().default(0),
  discoveredAt: timestamp('discovered_at', { withTimezone: true, mode: 'date' }).notNull(),
});

export const tokens = pgTable('tokens', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  mintAuthority: text('mint_authority'),
  freezeAuthority: text('freeze_authority'),
  transferHook: text('transfer_hook'),
  permanentDelegate: text('permanent_delegate'),
  feeConfig: text('fee_config'),
  verifiedBuild: text('verified_build'),
  upgradeAuthority: text('upgrade_authority'),
});

export const pools = pgTable('pools', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  dex: text('dex').notNull(),
  pair: text('pair').notNull(),
  tvlUsd: real('tvl_usd'),
  lockInfo: jsonb('lock_info').$type<Record<string, any> | null>(),
});

export const evidence = pgTable('evidence', {
  id: serial('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  type: text('type').notNull(),
  observedAt: timestamp('observed_at', { withTimezone: true, mode: 'date' }).notNull(),
  effectiveAt: timestamp('effective_at', { withTimezone: true, mode: 'date' }).notNull(),
  ingestedAt: timestamp('ingested_at', { withTimezone: true, mode: 'date' }).notNull(),
  source: text('source').notNull(),
  sourceUrl: text('source_url'),
  hash: text('hash'),
  payload: jsonb('payload').$type<Record<string, any>>().notNull().default({}),
  conclusion: text('conclusion'),
  conflictWith: integer('conflict_with'),
});

export const gates = pgTable('gates', {
  id: serial('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  ruleVersion: text('rule_version').notNull().default('v1.0'),
  category: text('category').notNull(),
  status: gateStatus('status').notNull(),
  reason: text('reason'),
  checkedAt: timestamp('checked_at', { withTimezone: true, mode: 'date' }).notNull(),
});

export const scores = pgTable('scores', {
  id: serial('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  version: text('version').notNull().default('v1.0'),
  narrative: real('narrative').notNull(),
  teamProduct: real('team_product').notNull(),
  capitalHolders: real('capital_holders').notNull(),
  marketStructure: real('market_structure').notNull(),
  lifecycleFit: real('lifecycle_fit').notNull(),
  total: real('total').notNull(),
  confidence: real('confidence').notNull(),
  freshness: real('freshness').notNull(),
  computedAt: timestamp('computed_at', { withTimezone: true, mode: 'date' }).notNull(),
});

export const wallets = pgTable('wallets', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  address: text('address').notNull(),
  entityId: text('entity_id').notNull(),
  label: text('label'),
  firstIn: timestamp('first_in', { withTimezone: true, mode: 'date' }),
  balanceUsd: real('balance_usd'),
});

export const entities = pgTable('entities', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  name: text('name').notNull(),
  type: text('type').notNull(),
  confidence: real('confidence').notNull(),
  evidenceSummary: text('evidence_summary'),
});

export const graphEdges = pgTable('graph_edges', {
  source: text('source').notNull(),
  target: text('target').notNull(),
  projectId: text('project_id').notNull().references(() => projects.id),
  type: text('type').notNull(),
  evidence: text('evidence'),
  confidence: real('confidence').notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.source, t.target, t.type, t.projectId] }),
}));

/**
 * M5 paper-authorized (rev2) — NO runtime writes until M5-EVIDENCE is done.
 * Presence is structural only; nothing in the current runtime graph inserts
 * into it. L4.
 */
export const shadowPositions = pgTable('shadow_positions', {
  id: serial('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  entryAt: timestamp('entry_at', { withTimezone: true, mode: 'date' }).notNull(),
  entryScore: real('entry_score').notNull(),
  simulatedSizeUsd: real('simulated_size_usd').notNull(),
  status: text('status').notNull().default('OPEN'),
  exitAt: timestamp('exit_at', { withTimezone: true, mode: 'date' }),
  exitReason: text('exit_reason'),
});

export const decisions = pgTable('decisions', {
  id: serial('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  conclusion: text('conclusion').notNull(),
  falsification: text('falsification'),
  nextReviewAt: timestamp('next_review_at', { withTimezone: true, mode: 'date' }),
  owner: text('owner'),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull(),
});

/** D1-A implementable subset. payload_ref / fact_payload_ref are dangling handles (no FK). */
export const collectionPlanItems = pgTable('collection_plan_item', {
  id: text('id').primaryKey(),
  sourceId: text('source_id').notNull(),
  methodId: text('method_id').notNull(),
  subjectProject: text('subject_project').notNull(),
  expectedFactKind: text('expected_fact_kind').notNull(),
  planVersion: text('plan_version').notNull(),
  observationTemplate: text('observation_template').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  retiredAt: timestamp('retired_at', { withTimezone: true, mode: 'date' }),
});

export const rawBlobs = pgTable('raw_blob', {
  blobKey: text('blob_key').primaryKey(),
  payloadHash: text('payload_hash').notNull(),
  scope: text('scope').notNull(),
  body: text('body').notNull(),
  length: integer('length').notNull(),
  mime: text('mime').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
});

export const collectionAttempts = pgTable('collection_attempt', {
  id: text('id').primaryKey(),
  observationKey: text('observation_key').notNull(),
  collectionPlanItemId: text('collection_plan_item_id'),
  projectId: text('project_id').notNull(),
  factKind: text('fact_kind').notNull(),
  sourceId: text('source_id').notNull(),
  methodId: text('method_id').notNull(),
  attemptOrigin: text('attempt_origin').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }).notNull(),
  leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  retryOfAttemptId: text('retry_of_attempt_id'),
  requestParamsSanitized: text('request_params_sanitized').notNull().default('{}'),
  timingQuality: text('timing_quality').notNull().default('LIVE'),
});

export const attemptOutcomes = pgTable('attempt_outcome_event', {
  id: text('id').primaryKey(),
  attemptId: text('attempt_id').notNull().unique(),
  outcome: text('outcome').notNull(),
  responseBytesReceived: integer('response_bytes_received').notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }).notNull(),
  errorCode: text('error_code'),
  errorBodyHash: text('error_body_hash'),
  errorBodyRef: text('error_body_ref'),
  retentionClass: text('retention_class').notNull().default('NONE'),
});

export const rawReceipts = pgTable('raw_receipt', {
  id: text('id').primaryKey(),
  receiptKey: text('receipt_key').notNull().unique(),
  observationKey: text('observation_key').notNull(),
  creatorOutcomeEventId: text('creator_outcome_event_id').notNull().unique(),
  status: text('status').notNull(),
  payloadHash: text('payload_hash').notNull(),
  payloadRef: text('payload_ref').notNull(),
  anchorSlot: integer('anchor_slot'),
  anchorTime: timestamp('anchor_time', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
});

export const attemptReceiptLinks = pgTable('attempt_receipt_link', {
  id: text('id').primaryKey(),
  outcomeEventId: text('outcome_event_id').notNull().unique(),
  receiptId: text('receipt_id').notNull(),
});

export const normalizedFacts = pgTable('normalized_fact', {
  id: text('id').primaryKey(),
  receiptId: text('receipt_id').notNull(),
  factKind: text('fact_kind').notNull(),
  subjectType: text('subject_type').notNull(),
  subjectId: text('subject_id').notNull(),
  payloadHash: text('payload_hash').notNull(),
  factPayloadRef: text('fact_payload_ref').notNull(),
  parserVersion: text('parser_version').notNull(),
  factLocalKey: text('fact_local_key').notNull().default('singleton'),
  effectiveTimeKind: text('effective_time_kind').notNull().default('OBSERVATION_BOUND'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
});

export const artifactRegistry = pgTable('artifact_registry', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(),
  version: text('version').notNull(),
  contentHash: text('content_hash').notNull(),
  contentRef: text('content_ref').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
});

export const receiptRelations = pgTable('receipt_relation', {
  id: text('id').primaryKey(),
  receiptId: text('receipt_id').notNull(),
  relatedReceiptId: text('related_receipt_id').notNull(),
  relation: text('relation').notNull(),
  basis: text('basis').notNull(),
  creatorRef: text('creator_ref').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
});

export const contestResolutions = pgTable('contest_resolution_event', {
  id: text('id').primaryKey(),
  contestedRelation: text('contested_relation').notNull(),
  basis: text('basis').notNull(),
  basisVersion: text('basis_version').notNull(),
  resolvedReceiptId: text('resolved_receipt_id').notNull(),
  authorizationRef: text('authorization_ref').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
});

export const factRelations = pgTable('fact_relation', {
  id: text('id').primaryKey(),
  factA: text('fact_a').notNull(),
  factB: text('fact_b').notNull(),
  relation: text('relation').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
});

export const factResolutions = pgTable('fact_resolution_event', {
  id: text('id').primaryKey(),
  factRelationId: text('fact_relation_id').notNull(),
  basis: text('basis').notNull(),
  basisVersion: text('basis_version').notNull(),
  resolvedFactId: text('resolved_fact_id').notNull(),
  authorizationRef: text('authorization_ref').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
});

export const factErasures = pgTable('fact_erasure_event', {
  id: text('id').primaryKey(),
  factId: text('fact_id').notNull(),
  disposition: text('disposition').notNull(),
  scope: text('scope').notNull(),
  authorizationRef: text('authorization_ref').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
});

export const rawDispositions = pgTable('raw_disposition_event', {
  id: text('id').primaryKey(),
  receiptId: text('receipt_id').notNull(),
  eventType: text('event_type').notNull(),
  actor: text('actor').notNull(),
  reason: text('reason').notNull(),
  authorizationRef: text('authorization_ref').notNull(),
  scope: text('scope').notNull(),
  idempotencyKey: text('idempotency_key').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
});

export const blobRefcounts = pgTable('blob_refcount_event', {
  id: text('id').primaryKey(),
  blobKey: text('blob_key').notNull(),
  eventType: text('event_type').notNull(),
  delta: integer('delta').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
});

export const interpretationContexts = pgTable('interpretation_context', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  asOf: timestamp('as_of', { withTimezone: true, mode: 'date' }).notNull(),
  mode: text('mode').notNull(),
  contractArtifactId: text('contract_artifact_id').notNull(),
  ruleArtifactId: text('rule_artifact_id').notNull(),
  sourcePriorityArtifactId: text('source_priority_artifact_id').notNull(),
  eligibilityPolicyArtifactId: text('eligibility_policy_artifact_id').notNull(),
  scoringArtifactId: text('scoring_artifact_id'),
  engineVersion: text('engine_version'),
  frozenBundle: text('frozen_bundle'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
});

export const interpretationContextFacts = pgTable('interpretation_context_fact', {
  contextId: text('context_id').notNull(),
  factId: text('fact_id').notNull(),
});

export const starSchemaVersion = pgTable('star_schema_version', {
  id: integer('id').primaryKey(),
  version: integer('version').notNull(),
  label: text('label').notNull(),
  appliedAt: timestamp('applied_at', { withTimezone: true, mode: 'date' }).notNull(),
});

export const interpretationContextParsers = pgTable('interpretation_context_parser', {
  contextId: text('context_id').notNull(),
  sourceId: text('source_id').notNull(),
  methodId: text('method_id').notNull(),
  parserId: text('parser_id').notNull(),
  factKind: text('fact_kind').notNull(),
  parserArtifactId: text('parser_artifact_id').notNull(),
});

// ── B1 Narrative Event Log (CONSENSUS-OPERATING-MODEL FROZEN-rev1) ──
// Append-only (DB triggers reject UPDATE/DELETE). Record reality only:
// no signal / score / gate / decision / exit is ever derived here.

export const b1Events = pgTable('b1_event', {
  id: text('id').primaryKey(),
  eventKey: text('event_key').notNull().unique(),
  label: text('label').notNull(),
  attention: real('attention'),
  observedAt: timestamp('observed_at', { withTimezone: true, mode: 'date' }).notNull(),
  ingestedAt: timestamp('ingested_at', { withTimezone: true, mode: 'date' }).notNull(),
  sourceId: text('source_id').notNull(),
  payloadHash: text('payload_hash').notNull(),
  payload: jsonb('payload').notNull(),
});

export const b1Narratives = pgTable('b1_narrative', {
  id: text('id').primaryKey(),
  narrativeKey: text('narrative_key').notNull().unique(),
  label: text('label').notNull(),
  aliases: jsonb('aliases').$type<string[]>().notNull().default([]),
  observedAt: timestamp('observed_at', { withTimezone: true, mode: 'date' }).notNull(),
  ingestedAt: timestamp('ingested_at', { withTimezone: true, mode: 'date' }).notNull(),
  sourceId: text('source_id').notNull(),
  payloadHash: text('payload_hash').notNull(),
  payload: jsonb('payload').notNull(),
});

export const b1EventNarrativeLinks = pgTable('b1_event_narrative_link', {
  id: text('id').primaryKey(),
  eventKey: text('event_key').notNull(),
  narrativeKey: text('narrative_key').notNull(),
  relation: text('relation').notNull(),
  observedAt: timestamp('observed_at', { withTimezone: true, mode: 'date' }).notNull(),
  ingestedAt: timestamp('ingested_at', { withTimezone: true, mode: 'date' }).notNull(),
  sourceId: text('source_id').notNull(),
  payloadHash: text('payload_hash').notNull(),
  payload: jsonb('payload').notNull(),
});

export const b1NarrativeAssets = pgTable('b1_narrative_asset', {
  id: text('id').primaryKey(),
  narrativeKey: text('narrative_key').notNull(),
  assetId: text('asset_id').notNull(),
  universe: text('universe').notNull(),
  venue: text('venue').notNull(),
  attributionBasis: text('attribution_basis').notNull(),
  observedAt: timestamp('observed_at', { withTimezone: true, mode: 'date' }).notNull(),
  ingestedAt: timestamp('ingested_at', { withTimezone: true, mode: 'date' }).notNull(),
  sourceId: text('source_id').notNull(),
  payloadHash: text('payload_hash').notNull(),
  payload: jsonb('payload').notNull(),
});

export const b1Anchors = pgTable('b1_anchor', {
  id: text('id').primaryKey(),
  narrativeKey: text('narrative_key').notNull(),
  anchor: text('anchor').notNull(),
  anchoredAt: timestamp('anchored_at', { withTimezone: true, mode: 'date' }).notNull(),
  basis: text('basis').notNull(),
  sourceId: text('source_id').notNull(),
  observedAt: timestamp('observed_at', { withTimezone: true, mode: 'date' }).notNull(),
  ingestedAt: timestamp('ingested_at', { withTimezone: true, mode: 'date' }).notNull(),
  payloadHash: text('payload_hash').notNull(),
  payload: jsonb('payload').notNull(),
});

// ── M1 Chain Observation (Acquisition Matrix V1) ──
// Observations only — never Evidence Truth, never Gate/Score/Decision.
// m1_observation / m1_dead_letter / m1_batch are append-only (DB triggers);
// m1_checkpoint (watermark) and m1_gap (lifecycle) are mutable by design.

export const m1Observations = pgTable('m1_observation', {
  id: text('id').primaryKey(),
  observationKey: text('observation_key').notNull().unique(),
  sourceId: text('source_id').notNull(),
  mode: text('mode').notNull(),
  slot: integer('slot').notNull(),
  signature: text('signature'),
  instructionIndex: integer('instruction_index'),
  kind: text('kind').notNull(),
  rawHash: text('raw_hash').notNull(),
  rawPayload: jsonb('raw_payload').notNull(),
  normalized: jsonb('normalized').notNull(),
  observedAt: timestamp('observed_at', { withTimezone: true, mode: 'date' }).notNull(),
  ingestedAt: timestamp('ingested_at', { withTimezone: true, mode: 'date' }).notNull(),
  batchId: text('batch_id').notNull(),
});

export const m1Checkpoint = pgTable('m1_checkpoint', {
  id: integer('id').primaryKey(),
  sourceId: text('source_id').notNull(),
  highestFullyProcessedSlot: integer('highest_fully_processed_slot').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull(),
});

export const m1Gaps = pgTable('m1_gap', {
  id: text('id').primaryKey(),
  sourceId: text('source_id').notNull(),
  fromSlot: integer('from_slot').notNull(),
  toSlot: integer('to_slot').notNull(),
  detectedAt: timestamp('detected_at', { withTimezone: true, mode: 'date' }).notNull(),
  status: text('status').notNull(),
  backfillBatchId: text('backfill_batch_id'),
});

export const m1DeadLetters = pgTable('m1_dead_letter', {
  id: text('id').primaryKey(),
  sourceId: text('source_id').notNull(),
  slot: integer('slot'),
  signature: text('signature'),
  observationKey: text('observation_key'),
  stage: text('stage').notNull(),
  error: text('error').notNull(),
  rawHash: text('raw_hash'),
  rawPayload: jsonb('raw_payload').notNull(),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true, mode: 'date' }).notNull(),
  retryCount: integer('retry_count').notNull().default(0),
});

export const m1Batches = pgTable('m1_batch', {
  id: text('id').primaryKey(),
  sourceId: text('source_id').notNull(),
  mode: text('mode').notNull(),
  fromSlot: integer('from_slot').notNull(),
  toSlot: integer('to_slot').notNull(),
  observationCount: integer('observation_count').notNull(),
  deadLetterCount: integer('dead_letter_count').notNull().default(0),
  committedAt: timestamp('committed_at', { withTimezone: true, mode: 'date' }).notNull(),
});
