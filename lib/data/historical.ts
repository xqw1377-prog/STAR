/**
 * HISTORICAL replay freezes a complete evaluation context.
 * Only objects visible at as_of may enter. Missing artifacts fail closed.
 * REINTERPRET uses the same evidence set with current policy versions.
 */
import { eq } from 'drizzle-orm';
import * as s from '@/db/schema';
import type { StarDb } from '@/lib/db';
import { evaluateFactsAsOf, type ProjectEvaluation } from '@/lib/engine';
import { RULE_VERSION } from '@/lib/domain/thresholds';
import { ENGINE_VERSION } from '@/lib/build-info';
import { newLedgerId, sha256hex } from './hash';
import { registerArtifact } from './relations';
import { ReplayError, requireArtifacts, resolveFactPayload } from './resolve';

export const DEFAULT_ARTIFACTS = {
  contract: 'art-contract-solana-readonly@3',
  rule: 'art-rule-gates@3',
  priority: 'art-priority-v1',
  eligibility: 'art-elig-v1',
  parser: 'art-parser@1',
  scoring: 'art-score-v1',
} as const;

export type HistoricalEvaluationContext = {
  as_of: string;
  project_id: string;
  fact_ids: string[];
  evidence_ids: number[];
  narrative_snapshot_ids: number[];
  lifecycle_event_ids: number[];
  entity_relation_ids: string[];
  entity_relations_omitted: 'UNTIMED_FAIL_CLOSED' | 'NONE';
  eligibility_policy_version: string;
  scoring_policy_version: string;
  contract_version: string;
  rule_version: string;
  evidence_cutoff: string;
  evaluation_engine_version: string;
};

export type HistoricalEvaluation = ProjectEvaluation & {
  context: HistoricalEvaluationContext;
  lifecycleAt: string;
  policy: {
    eligibility: string;
    scoring: string;
    rule: string;
    engine: string;
  };
};

export type ReinterpretResult = {
  mode: 'REINTERPRET';
  contextId: string;
  evaluation: HistoricalEvaluation;
  historical: HistoricalEvaluation;
  reasons: string[];
};

export async function ensureDefaultArtifacts(db: StarDb): Promise<void> {
  const specs = [
    { id: DEFAULT_ARTIFACTS.contract, kind: 'contract', version: 'solana-readonly@3' },
    { id: DEFAULT_ARTIFACTS.rule, kind: 'gate-rule', version: 'gates@3' },
    { id: DEFAULT_ARTIFACTS.priority, kind: 'source-priority', version: 'priority@1' },
    { id: DEFAULT_ARTIFACTS.eligibility, kind: 'eligibility-policy', version: 'elig@1' },
    { id: DEFAULT_ARTIFACTS.parser, kind: 'parser', version: 'parser@1' },
    { id: DEFAULT_ARTIFACTS.scoring, kind: 'scoring-policy', version: 'score@1' },
  ];
  for (const spec of specs) {
    const existing = await db.select().from(s.artifactRegistry).where(eq(s.artifactRegistry.id, spec.id));
    if (existing.length) continue;
    await registerArtifact(db, {
      id: spec.id,
      kind: spec.kind,
      version: spec.version,
      contentHash: await sha256hex(spec.id),
      contentRef: `artifact:${spec.id}`,
    });
  }
}

function visibleAt(row: { observedAt: Date; ingestedAt: Date; effectiveAt: Date }, asOf: Date): boolean {
  return row.observedAt <= asOf && row.ingestedAt <= asOf && row.effectiveAt <= asOf;
}

export async function freezeInterpretationContext(
  db: StarDb,
  args: { projectId: string; asOf: Date; mode?: 'HISTORICAL' | 'REINTERPRET' },
): Promise<string> {
  await ensureDefaultArtifacts(db);
  await requireArtifacts(db, Object.values(DEFAULT_ARTIFACTS).filter((id) => id !== DEFAULT_ARTIFACTS.parser));
  const id = newLedgerId('ctx');
  const evidence = (await db.select().from(s.evidence).where(eq(s.evidence.projectId, args.projectId)))
    .filter((row) => visibleAt(row, args.asOf));
  const facts = await db.select().from(s.normalizedFacts);
  const receipts = await db.select().from(s.rawReceipts);
  const byReceipt = new Map(receipts.map((r) => [r.id, r]));
  const factIds: string[] = [];
  for (const fact of facts.filter((f) => f.subjectId === args.projectId)) {
    const receipt = byReceipt.get(fact.receiptId);
    const t = receipt?.anchorTime;
    if (t && t > args.asOf) continue;
    factIds.push(fact.id);
  }
  const bundle: HistoricalEvaluationContext = {
    as_of: args.asOf.toISOString(),
    project_id: args.projectId,
    fact_ids: factIds,
    evidence_ids: evidence.map((e) => e.id),
    narrative_snapshot_ids: evidence.filter((e) => e.type === 'narrative-snapshot').map((e) => e.id),
    lifecycle_event_ids: evidence.filter((e) => e.type === 'lifecycle-transition').map((e) => e.id),
    entity_relation_ids: [],
    entity_relations_omitted: 'UNTIMED_FAIL_CLOSED',
    eligibility_policy_version: 'elig@1',
    scoring_policy_version: 'score@1',
    contract_version: 'solana-readonly@3',
    rule_version: RULE_VERSION,
    evidence_cutoff: args.asOf.toISOString(),
    evaluation_engine_version: ENGINE_VERSION,
  };
  await db.insert(s.interpretationContexts).values({
    id,
    projectId: args.projectId,
    asOf: args.asOf,
    mode: args.mode ?? 'HISTORICAL',
    contractArtifactId: DEFAULT_ARTIFACTS.contract,
    ruleArtifactId: DEFAULT_ARTIFACTS.rule,
    sourcePriorityArtifactId: DEFAULT_ARTIFACTS.priority,
    eligibilityPolicyArtifactId: DEFAULT_ARTIFACTS.eligibility,
    scoringArtifactId: DEFAULT_ARTIFACTS.scoring,
    engineVersion: ENGINE_VERSION,
    frozenBundle: JSON.stringify(bundle),
    createdAt: new Date(),
  });
  for (const factId of factIds) {
    await db.insert(s.interpretationContextFacts).values({ contextId: id, factId });
  }
  await db.insert(s.interpretationContextParsers).values({
    contextId: id,
    sourceId: 'fixture',
    methodId: 'replay',
    parserId: 'parser@1',
    factKind: '*',
    parserArtifactId: DEFAULT_ARTIFACTS.parser,
  });
  return id;
}

function readBundle(ctx: typeof s.interpretationContexts.$inferSelect): HistoricalEvaluationContext {
  if (ctx.frozenBundle) return JSON.parse(ctx.frozenBundle) as HistoricalEvaluationContext;
  return {
    as_of: ctx.asOf.toISOString(),
    project_id: ctx.projectId,
    fact_ids: [],
    evidence_ids: [],
    narrative_snapshot_ids: [],
    lifecycle_event_ids: [],
    entity_relation_ids: [],
    entity_relations_omitted: 'UNTIMED_FAIL_CLOSED',
    eligibility_policy_version: 'elig@1',
    scoring_policy_version: 'score@1',
    contract_version: 'solana-readonly@3',
    rule_version: RULE_VERSION,
    evidence_cutoff: ctx.asOf.toISOString(),
    evaluation_engine_version: ctx.engineVersion ?? ENGINE_VERSION,
  };
}

export async function historicalEvaluate(db: StarDb, contextId: string): Promise<HistoricalEvaluation> {
  const [ctx] = await db.select().from(s.interpretationContexts).where(eq(s.interpretationContexts.id, contextId));
  if (!ctx) throw new ReplayError('REPLAY_ARTIFACT_MISSING', `unknown context ${contextId}`);
  await requireArtifacts(db, [
    ctx.contractArtifactId,
    ctx.ruleArtifactId,
    ctx.sourcePriorityArtifactId,
    ctx.eligibilityPolicyArtifactId,
    ...(ctx.scoringArtifactId ? [ctx.scoringArtifactId] : []),
  ]);
  const parsers = await db.select().from(s.interpretationContextParsers).where(eq(s.interpretationContextParsers.contextId, contextId));
  for (const p of parsers) await requireArtifacts(db, [p.parserArtifactId]);
  const bundle = readBundle(ctx);
  const receipts = await db.select().from(s.rawReceipts);
  const byReceipt = new Map(receipts.map((r) => [r.id, r]));
  const rows: Array<{
    id: string | number;
    type: string;
    observedAt: Date;
    effectiveAt: Date;
    ingestedAt: Date;
    source: string;
    payload: unknown;
    conclusion: string | null;
  }> = [];
  for (const factId of bundle.fact_ids) {
    const [fact] = await db.select().from(s.normalizedFacts).where(eq(s.normalizedFacts.id, factId));
    if (!fact) continue;
    const resolved = await resolveFactPayload(db, fact.id);
    if (resolved.status !== 'PAYLOAD') continue;
    const receipt = byReceipt.get(fact.receiptId);
    const when = receipt?.anchorTime ?? ctx.asOf;
    if (when > ctx.asOf) continue;
    rows.push({
      id: fact.id,
      type: fact.factKind,
      observedAt: when,
      effectiveAt: when,
      ingestedAt: when,
      source: 'historical',
      payload: JSON.parse(resolved.body),
      conclusion: fact.factKind,
    });
  }
  if (bundle.evidence_ids.length) {
    const evidence = await db.select().from(s.evidence).where(eq(s.evidence.projectId, ctx.projectId));
    const wanted = new Set(bundle.evidence_ids);
    for (const row of evidence.filter((e) => wanted.has(e.id))) {
      if (!visibleAt(row, ctx.asOf)) continue;
      if (row.type !== 'narrative-snapshot' && row.type !== 'lifecycle-transition') continue;
      rows.push({
        id: row.id,
        type: row.type,
        observedAt: row.observedAt,
        effectiveAt: row.effectiveAt,
        ingestedAt: row.ingestedAt,
        source: row.source,
        payload: row.payload,
        conclusion: row.conclusion,
      });
    }
  }
  const evaluation = evaluateFactsAsOf({
    projectId: ctx.projectId,
    asOf: ctx.asOf,
    lifecycle: 'UNKNOWN',
    discoveredAt: ctx.asOf,
    narrative: null,
    rows,
    ignoreCache: true,
  });
  return {
    ...evaluation,
    context: bundle,
    lifecycleAt: evaluation.readiness === 'TOO_LATE' ? 'CROWDING' : 'from-facts',
    policy: {
      eligibility: bundle.eligibility_policy_version,
      scoring: bundle.scoring_policy_version,
      rule: bundle.rule_version,
      engine: bundle.evaluation_engine_version,
    },
  };
}

function diffReasons(a: HistoricalEvaluation, b: HistoricalEvaluation): string[] {
  const reasons: string[] = [];
  if (JSON.stringify(a.gates) !== JSON.stringify(b.gates)) reasons.push('gates');
  if (a.readiness !== b.readiness) reasons.push('readiness');
  if (JSON.stringify(a.score) !== JSON.stringify(b.score)) reasons.push('scores');
  if (JSON.stringify(a.context.narrative_snapshot_ids) !== JSON.stringify(b.context.narrative_snapshot_ids)) {
    reasons.push('narrative');
  }
  if (JSON.stringify(a.context.lifecycle_event_ids) !== JSON.stringify(b.context.lifecycle_event_ids)) {
    reasons.push('lifecycle');
  }
  if (a.policy.eligibility !== b.policy.eligibility) reasons.push('eligibility');
  if (a.context.evaluation_engine_version !== b.context.evaluation_engine_version) reasons.push('engine');
  return reasons;
}

export async function reinterpretEvaluate(
  db: StarDb,
  projectId: string,
  asOf: Date,
): Promise<ReinterpretResult> {
  const historicalId = await freezeInterpretationContext(db, { projectId, asOf, mode: 'HISTORICAL' });
  const historical = await historicalEvaluate(db, historicalId);
  const reinterpretId = await freezeInterpretationContext(db, { projectId, asOf, mode: 'REINTERPRET' });
  const evaluation = await historicalEvaluate(db, reinterpretId);
  return {
    mode: 'REINTERPRET',
    contextId: reinterpretId,
    evaluation: { ...evaluation, context: { ...evaluation.context } },
    historical,
    reasons: diffReasons(historical, evaluation),
  };
}

export function contextFingerprint(ctx: HistoricalEvaluationContext): string {
  return JSON.stringify({
    as_of: ctx.as_of,
    fact_ids: [...ctx.fact_ids].sort(),
    evidence_ids: [...ctx.evidence_ids].sort((a, b) => a - b),
    narrative_snapshot_ids: [...ctx.narrative_snapshot_ids].sort((a, b) => a - b),
    lifecycle_event_ids: [...ctx.lifecycle_event_ids].sort((a, b) => a - b),
    eligibility_policy_version: ctx.eligibility_policy_version,
    scoring_policy_version: ctx.scoring_policy_version,
    rule_version: ctx.rule_version,
  });
}
