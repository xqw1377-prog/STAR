/**
 * I/O + scoring + readiness + persistence orchestration.
 * Gate interpretation and temporal filtering live in lib/domain.
 */
import { eq } from 'drizzle-orm';
import * as s from '@/db/schema';
import type { StarDb } from './db';
import {
  evaluateChecksAt,
  interpretCheck,
  latestEvidenceByCheck,
  quarantineReason,
  scoringAllowed,
  type CheckObservation,
} from '@/lib/domain';
import {
  GATE_CHECKS,
  gateKeys,
  type CheckKey,
  type Evidence,
  type GateCheck,
  type GateStatus,
} from '@/lib/domain/types';
import { RULE_VERSION } from '@/lib/domain/thresholds';
import { resolveLifecycleAt, resolveNarrativeAt } from '@/lib/domain/research';
import type {
  HolderDistributionPayload,
  LiquidityPayload,
  ProgramVerificationPayload,
  RelatedWalletsPayload,
} from '@/lib/data/contract';

export { RULE_VERSION };
export { gateKeys as GATE_ORDER };

const WEIGHTS = { narrative: 0.25, teamProduct: 0.2, capitalHolders: 0.2, marketStructure: 0.2, lifecycleFit: 0.15 };

export interface GateGroupResult {
  gate: string;
  status: GateStatus;
  reason: string;
  checks: GateCheck[];
  completeness: number;
}

export interface ScoreBreakdown {
  narrative: number; teamProduct: number; capitalHolders: number; marketStructure: number; lifecycleFit: number;
  total: number; confidence: number; freshness: number;
}

export type Readiness = 'BLOCKED' | 'RESEARCH_REQUIRED' | 'READY' | 'TOO_LATE';

export interface ProjectEvaluation {
  projectId: string;
  asOf: string;
  gates: GateGroupResult[];
  allPass: boolean;
  score: ScoreBreakdown | null;
  readiness: Readiness;
  blockedBy: string[];
  evidenceUsed: Evidence[];
  quarantined: { id: string; reason: string }[];
  ineligible: { id: string; reason: string }[];
}

type Row = {
  id: string | number;
  type: string;
  observedAt: Date;
  effectiveAt: Date;
  ingestedAt: Date;
  source: string;
  payload: unknown;
  conclusion: string | null;
};

export type EvaluateFactsInput = {
  projectId: string;
  asOf: Date;
  lifecycle: string;
  discoveredAt: Date;
  narrative?: {
    novelty: number;
    velocity: number;
    breadth: number;
    onChainConfirm: number;
    survival: number;
    updatedAt: Date;
  } | null;
  rows: Row[];
  ineligible?: Array<{ id: string; reason: string }>;
  ignoreCache?: boolean;
};

function toKernelEvidence(r: Row): Evidence {
  return {
    id: String(r.id),
    checkKey: r.type as CheckKey,
    claim: r.conclusion ?? '',
    source: r.source,
    sourceKind: r.source === 'fixture' ? 'SYNTHETIC' : 'CHAIN',
    effectiveAt: r.effectiveAt.toISOString(),
    observedAt: r.observedAt.toISOString(),
    ingestedAt: r.ingestedAt.toISOString(),
    confidence: 1,
  };
}

function violatesInvariant(r: Row): string | null {
  return quarantineReason(r.observedAt, r.ingestedAt, r.effectiveAt);
}

const UNKNOWN = (key: CheckKey): GateCheck => ({ key, status: 'UNKNOWN' });

function checkFromEvidence(key: CheckKey, ev: Evidence | undefined, payload: unknown, asOf: Date): GateCheck {
  const interpreted = interpretCheck(key, payload, { asOf });
  return { key, status: interpreted.status, evidence: ev };
}

/** Payloads ride alongside kernel evidence in the same DB row. */
function checkFor(key: CheckKey, latest: Map<CheckKey, Evidence>, payloads: Map<string, unknown>, asOf: Date): GateCheck {
  const ev = latest.get(key);
  if (!ev) return UNKNOWN(key);
  return checkFromEvidence(key, ev, payloads.get(ev.id), asOf);
}

export function evaluateFactsAsOf(input: EvaluateFactsInput): ProjectEvaluation {
  const { projectId, asOf } = input;
  const narrative = input.narrative ?? undefined;
  const rows = input.rows;
  const researchRows = rows.filter((r) => r.type === 'narrative-snapshot' || r.type === 'lifecycle-transition');
  const gateRows = rows.filter((r) => r.type !== 'narrative-snapshot' && r.type !== 'lifecycle-transition');
  const quarantined: { id: string; reason: string }[] = [];
  const ineligible = [...(input.ineligible ?? [])];
  const ineligibleIds = new Set(ineligible.map((x) => x.id));
  const kernel: Evidence[] = [];
  const payloads = new Map<string, unknown>();
  for (const r of gateRows) {
    const violation = violatesInvariant(r);
    if (violation) {
      quarantined.push({ id: String(r.id), reason: violation });
      continue;
    }
    if (ineligibleIds.has(String(r.id))) continue;
    const ev = toKernelEvidence(r);
    payloads.set(ev.id, r.payload);
    kernel.push(ev);
  }

  const cutoff = asOf.toISOString();
  const latest = latestEvidenceByCheck(kernel, cutoff);
  const evidenceUsed = [...latest.values()];

  const observations: CheckObservation[] = kernel.map((ev) => {
    const computed = checkFromEvidence(ev.checkKey, ev, payloads.get(ev.id), asOf);
    return {
      id: ev.id,
      project_id: projectId,
      check: ev.checkKey,
      status: computed.status,
      claim: ev.claim,
      source: ev.source,
      source_kind: ev.sourceKind === 'SYNTHETIC' ? 'fixture' : ev.sourceKind === 'SIMULATION' ? 'dex' : 'solana-rpc',
      effective_at: ev.effectiveAt,
      observed_at: ev.observedAt,
      ingested_at: ev.ingestedAt,
      confidence: ev.confidence,
    };
  });
  const kernelEval = evaluateChecksAt(observations, asOf, projectId);
  const kernelByGate = new Map(kernelEval.results.map((r) => [r.check_key, r]));

  const gates: GateGroupResult[] = gateKeys.map((gate) => {
    const checks = GATE_CHECKS[gate].map((key) => checkFor(key, latest, payloads, asOf));
    const fromKernel = kernelByGate.get(gate);
    const status: GateStatus = fromKernel?.status ?? 'UNKNOWN';
    const completeness = checks.filter((c) => c.status !== 'UNKNOWN').length / checks.length;
    return { gate, status, checks, completeness, reason: fromKernel?.claim ?? summarize(checks) };
  });

  const allPass = scoringAllowed(kernelEval);
  const blockedBy = gates.filter((g) => g.status !== 'PASS').map((g) => `${g.gate}:${g.status}`);

  let score: ScoreBreakdown | null = null;
  if (allPass) {
    const holders = latest.get('holder-distribution')!;
    const related = latest.get('related-wallets')!;
    const liq = latest.get('liquidity')!;
    const prog = latest.get('program-verification')!;
    const holdersPayload = payloads.get(holders.id) as HolderDistributionPayload;
    const holdersPct = holdersPayload.top10PctEntityAdjusted ?? holdersPayload.top10Pct;
    const clusterPct = (payloads.get(related.id) as RelatedWalletsPayload).clusterPct;
    const tvl = (payloads.get(liq.id) as LiquidityPayload).tvlUsdTotal!;
    const progPayload = payloads.get(prog.id) as ProgramVerificationPayload;
    const narr = resolveNarrativeAt(researchRows, asOf);
    const life = resolveLifecycleAt(researchRows, asOf);
    const hasNarrFacts = researchRows.some((r) => r.type === 'narrative-snapshot' && r.observedAt <= asOf && r.effectiveAt <= asOf);
    const hasLifeFacts = researchRows.some((r) => r.type === 'lifecycle-transition' && r.observedAt <= asOf && r.effectiveAt <= asOf);
    const narrativeAt = narr.contested
      ? null
      : narr.payload
        ? narr.payload
        : !input.ignoreCache && !hasNarrFacts && narrative && narrative.updatedAt <= asOf
          ? narrative
          : null;
    const lifecycleAt = life.contested
      ? 'UNKNOWN'
      : hasLifeFacts
        ? life.stage
        : !input.ignoreCache && input.discoveredAt <= asOf
          ? input.lifecycle
          : 'UNKNOWN';
    const narrativeScore = narrativeAt
      ? ((narrativeAt.novelty + narrativeAt.velocity + narrativeAt.breadth + narrativeAt.onChainConfirm + narrativeAt.survival) / 5) * 100
      : 50;
    const parts = {
      narrative: narrativeScore,
      teamProduct: progPayload.verifiedBuild ? 80 : 60,
      capitalHolders: Math.max(0, Math.min(100, Math.round(100 - 120 * Math.max(holdersPct, clusterPct)))),
      marketStructure: Math.max(0, Math.min(90, Math.round((tvl / 1_000_000) * 40 + 40))),
      lifecycleFit: lifecycleScore(lifecycleAt),
    };
    const total = Object.entries(WEIGHTS).reduce((acc, [k, w]) => acc + parts[k as keyof typeof parts] * w, 0);
    const newestObserved = Math.max(...evidenceUsed.map((e) => new Date(e.observedAt).getTime()));
    const freshness = Math.max(0, 1 - (asOf.getTime() - newestObserved) / 86400000 / 7);
    const sources = new Set(evidenceUsed.map((e) => e.source));
    const confidence = Number(Math.min(1, 0.35 + 0.25 * freshness + 0.2 * Math.min(sources.size, 3) / 3 + 0.2).toFixed(2));
    score = {
      ...parts,
      total: Number(total.toFixed(1)),
      confidence,
      freshness: Number(freshness.toFixed(2)),
    };
  }

  const life = resolveLifecycleAt(researchRows, asOf);
  const hasLifeFacts = researchRows.some((r) => r.type === 'lifecycle-transition' && r.observedAt <= asOf && r.effectiveAt <= asOf);
  const lifecycleAt = life.contested
    ? 'UNKNOWN'
    : hasLifeFacts
      ? life.stage
      : !input.ignoreCache && input.discoveredAt <= asOf
        ? input.lifecycle
        : 'UNKNOWN';
  const evidenceCompleteness = gates.reduce((acc, g) => acc + g.completeness, 0) / Math.max(gates.length, 1);
  const readiness: Readiness = gates.some((g) => g.status === 'FAIL')
    ? 'BLOCKED'
    : gates.some((g) => g.status === 'UNKNOWN') || evidenceCompleteness < 1
      ? 'RESEARCH_REQUIRED'
      : ['CROWDING', 'DISTRIBUTION', 'DEAD'].includes(lifecycleAt)
        ? 'TOO_LATE'
        : 'READY';

  return { projectId, asOf: cutoff, gates, allPass, score, readiness, blockedBy, evidenceUsed, quarantined, ineligible };
}

export async function evaluateProjectAsOf(db: StarDb, projectId: string, asOf: Date): Promise<ProjectEvaluation> {
  const [project] = await db.select().from(s.projects).where(eq(s.projects.id, projectId));
  if (!project) throw new Error(`unknown project ${projectId}`);
  const [narrative] = project.narrativeId
    ? await db.select().from(s.narratives).where(eq(s.narratives.id, project.narrativeId))
    : [undefined];
  const rows = await db.select().from(s.evidence).where(eq(s.evidence.projectId, projectId));
  const { loadIneligibleFacts, evidenceKey } = await import('@/lib/data/eligibility');
  const blocked = await loadIneligibleFacts(db);
  const byKey = new Map(blocked.map((f) => [evidenceKey(f.subjectId, f.factKind, f.payloadHash), f.reason]));
  const ineligible = rows.flatMap((r) => {
    if (!r.hash) return [];
    const reason = byKey.get(evidenceKey(projectId, r.type, r.hash));
    return reason ? [{ id: String(r.id), reason }] : [];
  });
  return evaluateFactsAsOf({
    projectId,
    asOf,
    lifecycle: project.lifecycle,
    discoveredAt: project.discoveredAt,
    narrative: narrative ?? null,
    rows,
    ineligible,
  });
}

function summarize(checks: GateCheck[]): string {
  return checks
    .map((c) => `${c.key}:${c.status}${c.status === 'UNKNOWN' ? ' (no evidence)' : ''}`)
    .join(', ');
}

function lifecycleScore(stage: string): number {
  const map: Record<string, number> = { SEED: 85, IGNITION: 90, VERIFIED: 80, ACCELERATION: 60, CROWDING: 20, DISTRIBUTION: 5, DEAD: 0 };
  return map[stage] ?? 50;
}

/** Back-compat wrapper: flat check list evaluated at "now". */
export async function evaluateGates(db: StarDb, projectId: string) {
  const evaluation = await evaluateProjectAsOf(db, projectId, new Date());
  return evaluation.gates.flatMap((g) => g.checks.map((c) => ({ category: c.key, status: c.status, reason: g.reason })));
}

/** Back-compat wrapper: zeros when gates do not all pass — a blocked project never scores. */
export async function computeOpportunityScore(db: StarDb, projectId: string) {
  const { score } = await evaluateProjectAsOf(db, projectId, new Date());
  const zeros: ScoreBreakdown = { narrative: 0, teamProduct: 0, capitalHolders: 0, marketStructure: 0, lifecycleFit: 0, total: 0, confidence: 0, freshness: 0 };
  return score ?? zeros;
}

/** Persist gate groups, score (only when earned) and decision readiness. */
export async function refreshProject(db: StarDb, projectId: string, asOf: Date = new Date()) {
  const evaluation = await evaluateProjectAsOf(db, projectId, asOf);
  await db.delete(s.gates).where(eq(s.gates.projectId, projectId));
  if (evaluation.gates.length) {
    await db.insert(s.gates).values(
      evaluation.gates.map((g) => ({
        projectId,
        ruleVersion: RULE_VERSION,
        category: g.gate,
        status: g.status,
        reason: `${g.reason} [rule ${RULE_VERSION} @ ${evaluation.asOf}]`,
        checkedAt: asOf,
      })),
    );
  }
  await db.delete(s.scores).where(eq(s.scores.projectId, projectId));
  if (evaluation.score && evaluation.readiness === 'READY') {
    await db.insert(s.scores).values({
      projectId, version: RULE_VERSION,
      narrative: evaluation.score.narrative, teamProduct: evaluation.score.teamProduct,
      capitalHolders: evaluation.score.capitalHolders, marketStructure: evaluation.score.marketStructure,
      lifecycleFit: evaluation.score.lifecycleFit, total: evaluation.score.total,
      confidence: evaluation.score.confidence, freshness: evaluation.score.freshness, computedAt: asOf,
    });
  }
  const completeness = evaluation.gates.reduce((acc, g) => acc + g.completeness, 0) / Math.max(evaluation.gates.length, 1);
  const lifecycleFit = (evaluation.score?.lifecycleFit ?? 0) / 100;
  const opportunity = evaluation.score ? evaluation.score.total / 100 : 0;
  const readinessValue = evaluation.readiness === 'READY'
    ? Number((completeness * opportunity * Math.max(lifecycleFit, 0.05)).toFixed(3))
    : 0;
  await db.update(s.projects).set({ decisionReadiness: readinessValue }).where(eq(s.projects.id, projectId));
  return evaluation;
}
