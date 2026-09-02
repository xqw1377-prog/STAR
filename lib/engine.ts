/**
 * I/O adapter only. Interpretation and aggregation live in lib/domain.
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
}

type Row = typeof s.evidence.$inferSelect;

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

const UNKNOWN = (key: CheckKey, reason: string): GateCheck => ({ key, status: 'UNKNOWN' });

function checkFromEvidence(key: CheckKey, ev: Evidence | undefined, payload: unknown): GateCheck {
  const interpreted = interpretCheck(key, payload);
  return { key, status: interpreted.status, evidence: ev };
}

/** Payloads ride alongside kernel evidence in the same DB row. */
function checkFor(key: CheckKey, latest: Map<CheckKey, Evidence>, payloads: Map<string, unknown>): GateCheck {
  const ev = latest.get(key);
  if (!ev) return UNKNOWN(key, 'no evidence');
  return checkFromEvidence(key, ev, payloads.get(ev.id));
}

export async function evaluateProjectAsOf(db: StarDb, projectId: string, asOf: Date): Promise<ProjectEvaluation> {
  const [project] = await db.select().from(s.projects).where(eq(s.projects.id, projectId));
  if (!project) throw new Error(`unknown project ${projectId}`);
  const [narrative] = project.narrativeId
    ? await db.select().from(s.narratives).where(eq(s.narratives.id, project.narrativeId))
    : [undefined];

  const rows = await db.select().from(s.evidence).where(eq(s.evidence.projectId, projectId));
  const quarantined: { id: string; reason: string }[] = [];
  const kernel: Evidence[] = [];
  const payloads = new Map<string, unknown>();
  for (const r of rows) {
    const violation = violatesInvariant(r);
    if (violation) {
      quarantined.push({ id: String(r.id), reason: violation });
      continue;
    }
    const ev = toKernelEvidence(r);
    payloads.set(ev.id, r.payload);
    kernel.push(ev);
  }

  const cutoff = asOf.toISOString();
  const latest = latestEvidenceByCheck(kernel, cutoff);
  const evidenceUsed = [...latest.values()];

  const observations: CheckObservation[] = kernel.map((ev) => {
    const computed = checkFromEvidence(ev.checkKey, ev, payloads.get(ev.id));
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
    const checks = GATE_CHECKS[gate].map((key) => checkFor(key, latest, payloads));
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
    const narrativeScore = narrative
      ? ((narrative.novelty + narrative.velocity + narrative.breadth + narrative.onChainConfirm + narrative.survival) / 5) * 100
      : 50;
    const parts = {
      narrative: narrativeScore,
      teamProduct: progPayload.verifiedBuild ? 80 : 60,
      capitalHolders: Math.max(0, Math.min(100, Math.round(100 - 120 * Math.max(holdersPct, clusterPct)))),
      marketStructure: Math.max(0, Math.min(90, Math.round((tvl / 1_000_000) * 40 + 40))),
      lifecycleFit: lifecycleScore(project.lifecycle),
    };
    const total = Object.entries(WEIGHTS).reduce((acc, [k, w]) => acc + parts[k as keyof typeof parts] * w, 0);
    const newestObserved = Math.max(...evidenceUsed.map((e) => new Date(e.observedAt).getTime()));
    const freshness = Math.max(0, 1 - (asOf.getTime() - newestObserved) / 86400000 / 7);
    score = {
      ...parts,
      total: Number(total.toFixed(1)),
      confidence: Number((0.6 + 0.4 * freshness).toFixed(2)),
      freshness: Number(freshness.toFixed(2)),
    };
  }

  const readiness: Readiness = gates.some((g) => g.status === 'FAIL')
    ? 'BLOCKED'
    : gates.some((g) => g.status === 'UNKNOWN')
      ? 'RESEARCH_REQUIRED'
      : ['CROWDING', 'DISTRIBUTION', 'DEAD'].includes(project.lifecycle)
        ? 'TOO_LATE'
        : 'READY';

  return { projectId, asOf: cutoff, gates, allPass, score, readiness, blockedBy, evidenceUsed, quarantined };
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
  if (evaluation.score) {
    await db.insert(s.scores).values({
      projectId, version: RULE_VERSION,
      narrative: evaluation.score.narrative, teamProduct: evaluation.score.teamProduct,
      capitalHolders: evaluation.score.capitalHolders, marketStructure: evaluation.score.marketStructure,
      lifecycleFit: evaluation.score.lifecycleFit, total: evaluation.score.total,
      confidence: evaluation.score.confidence, freshness: evaluation.score.freshness, computedAt: asOf,
    });
  }
  const readinessValue = evaluation.readiness === 'READY' ? evaluation.score!.total / 100 : 0;
  await db.update(s.projects).set({ decisionReadiness: Number(readinessValue.toFixed(3)) }).where(eq(s.projects.id, projectId));
  return evaluation;
}
