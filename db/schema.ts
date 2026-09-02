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
