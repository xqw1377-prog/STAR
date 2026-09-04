/**
 * Data Health projection (rev6). Describes observation capability only.
 * Never writes readiness, gates, or scores. Never imported by interpret/gates.
 */
import * as s from '@/db/schema';
import type { StarDb } from '@/lib/db';

export const HEALTH_WINDOW_MS = 3_600_000;

export const TERMINAL_OUTCOMES = [
  'SUCCESS',
  'PARTIAL',
  'SOURCE_ERROR',
  'TRANSPORT_ERROR',
  'TIMEOUT',
  'ABORTED',
] as const;

export type TerminalOutcome = (typeof TERMINAL_OUTCOMES)[number];

export type SixRates = {
  success_rate: number | null;
  partial_rate: number | null;
  source_error_rate: number | null;
  transport_error_rate: number | null;
  timeout_rate: number | null;
  aborted_rate: number | null;
};

export type DegradedReason =
  | 'LICENSE_HOLD'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'CONFLICTED'
  | 'PARSER_DEGRADED'
  | 'SOURCE_ERROR'
  | 'NO_SAMPLE'
  | 'BACKFILL_ONLY'
  | 'NONE';

export type HealthSlice = SixRates & {
  response_availability: number | null;
  unresolved_rate: number | null;
  terminal_n: number;
  start_n: number;
  completeness: number | null;
  degraded_reason: DegradedReason[];
};

export type SourceHealth = HealthSlice & { source_id: string; method_id: string };
export type ProjectHealth = HealthSlice & { project_id: string; fact_kind: string };

export type DeskHealth = {
  window_ms: number;
  as_of: string;
  source: SourceHealth[];
  project: ProjectHealth[];
  overall: HealthSlice;
  backfill_n: number;
  window_attempt_ids: string[];
};

const NULL_RATES: SixRates = {
  success_rate: null,
  partial_rate: null,
  source_error_rate: null,
  transport_error_rate: null,
  timeout_rate: null,
  aborted_rate: null,
};

type AttemptRow = typeof s.collectionAttempts.$inferSelect;
type OutcomeRow = typeof s.attemptOutcomes.$inferSelect;
type PlanRow = typeof s.collectionPlanItems.$inferSelect;
type FactRow = typeof s.normalizedFacts.$inferSelect;

function rateKey(outcome: TerminalOutcome): keyof SixRates {
  switch (outcome) {
    case 'SUCCESS': return 'success_rate';
    case 'PARTIAL': return 'partial_rate';
    case 'SOURCE_ERROR': return 'source_error_rate';
    case 'TRANSPORT_ERROR': return 'transport_error_rate';
    case 'TIMEOUT': return 'timeout_rate';
    case 'ABORTED': return 'aborted_rate';
  }
}

function sixFrom(outcomes: OutcomeRow[]): SixRates & { response_availability: number | null; terminal_n: number } {
  if (!outcomes.length) {
    return { ...NULL_RATES, response_availability: null, terminal_n: 0 };
  }
  const rates: SixRates = { ...NULL_RATES };
  for (const key of TERMINAL_OUTCOMES) {
    rates[rateKey(key)] = outcomes.filter((o) => o.outcome === key).length / outcomes.length;
  }
  const available = outcomes.filter((o) => o.responseBytesReceived === 1).length / outcomes.length;
  return { ...rates, response_availability: available, terminal_n: outcomes.length };
}

function unresolvedRate(starts: AttemptRow[], outcomes: OutcomeRow[], now: Date): number | null {
  if (!starts.length) return null;
  const byAttempt = new Set(outcomes.map((o) => o.attemptId));
  const unresolved = starts.filter((a) => !byAttempt.has(a.id) && now > a.leaseExpiresAt).length;
  return unresolved / starts.length;
}

function isLiveAttempt(row: AttemptRow): boolean {
  return row.timingQuality !== 'BACKFILLED_UNKNOWN';
}

export function degradedReasons(
  slice: Pick<HealthSlice, keyof SixRates | 'terminal_n' | 'unresolved_rate'> & { held?: boolean; conflicted?: boolean; rateLimited?: boolean; backfillOnly?: boolean },
): DegradedReason[] {
  if (slice.terminal_n === 0) return slice.backfillOnly ? ['BACKFILL_ONLY'] : ['NO_SAMPLE'];
  const reasons: DegradedReason[] = [];
  if (slice.held) reasons.push('LICENSE_HOLD');
  if (slice.rateLimited) reasons.push('RATE_LIMITED');
  if ((slice.timeout_rate ?? 0) > 0) reasons.push('TIMEOUT');
  if (slice.conflicted) reasons.push('CONFLICTED');
  if ((slice.unresolved_rate ?? 0) > 0) reasons.push('PARSER_DEGRADED');
  if ((slice.source_error_rate ?? 0) > 0) reasons.push('SOURCE_ERROR');
  return reasons.length ? reasons : ['NONE'];
}

function degraded(slice: Pick<HealthSlice, keyof SixRates | 'terminal_n' | 'unresolved_rate'>): DegradedReason[] {
  return degradedReasons(slice);
}

function completenessFor(
  plans: PlanRow[],
  facts: FactRow[],
  match: { projectId?: string; factKind?: string },
): number | null {
  const active = plans.filter((p) => !p.retiredAt
    && (!match.projectId || p.subjectProject === match.projectId)
    && (!match.factKind || p.expectedFactKind === match.factKind));
  if (!active.length) return null;
  const needed = new Set(active.map((p) => `${p.subjectProject}|${p.expectedFactKind}`));
  const have = new Set(
    facts
      .filter((f) => f.subjectType === 'project' && needed.has(`${f.subjectId}|${f.factKind}`))
      .map((f) => `${f.subjectId}|${f.factKind}`),
  );
  return have.size / needed.size;
}

function sliceOf(
  starts: AttemptRow[],
  outcomes: OutcomeRow[],
  now: Date,
  completeness: number | null,
): HealthSlice {
  const rates = sixFrom(outcomes);
  const unresolved_rate = unresolvedRate(starts, outcomes, now);
  const base = {
    ...rates,
    unresolved_rate,
    start_n: starts.length,
    completeness,
    degraded_reason: [] as DegradedReason[],
  };
  return { ...base, degraded_reason: degraded(base) };
}

export function projectHealthFromRows(
  attempts: AttemptRow[],
  outcomes: OutcomeRow[],
  plans: PlanRow[],
  facts: FactRow[],
  now: Date,
  windowMs = HEALTH_WINDOW_MS,
): DeskHealth {
  const windowStart = new Date(now.getTime() - windowMs);
  const liveAttempts = attempts.filter(isLiveAttempt);
  const backfillAttempts = attempts.filter((a) => !isLiveAttempt(a));
  const liveIds = new Set(liveAttempts.map((a) => a.id));
  const startsInWindow = liveAttempts.filter((a) => a.startedAt >= windowStart && a.startedAt <= now);
  const outcomesInWindow = outcomes.filter((o) => liveIds.has(o.attemptId) && o.completedAt >= windowStart && o.completedAt <= now);

  const sourceKeys = new Set(attempts.map((a) => `${a.sourceId}|${a.methodId}`));
  const source: SourceHealth[] = [...sourceKeys].map((key) => {
    const [source_id, method_id] = key.split('|');
    const starts = startsInWindow.filter((a) => a.sourceId === source_id && a.methodId === method_id);
    const outs = outcomesInWindow.filter((o) => {
      const a = attempts.find((x) => x.id === o.attemptId);
      return a?.sourceId === source_id && a?.methodId === method_id;
    });
    return {
      source_id,
      method_id,
      ...sliceOf(starts, outs, now, null),
    };
  });

  const projectKeys = new Set([
    ...plans.filter((p) => !p.retiredAt).map((p) => `${p.subjectProject}|${p.expectedFactKind}`),
    ...attempts.filter((a) => a.collectionPlanItemId).map((a) => `${a.projectId}|${a.factKind}`),
  ]);
  const project: ProjectHealth[] = [...projectKeys].map((key) => {
    const [project_id, fact_kind] = key.split('|');
    // T28: failed/timed-out attempts with a plan item still count toward ProjectHealth.
    const attributedStarts = startsInWindow.filter((a) => {
      if (!a.collectionPlanItemId) return false;
      if (a.projectId === project_id && a.factKind === fact_kind) return true;
      const plan = plans.find((p) => p.id === a.collectionPlanItemId);
      return plan?.subjectProject === project_id && plan?.expectedFactKind === fact_kind;
    });
    const attributedOuts = outcomesInWindow.filter((o) => {
      const a = attempts.find((x) => x.id === o.attemptId);
      return Boolean(a && attributedStarts.some((x) => x.id === a.id));
    });
    return {
      project_id,
      fact_kind,
      ...sliceOf(
        attributedStarts,
        attributedOuts,
        now,
        completenessFor(plans, facts, { projectId: project_id, factKind: fact_kind }),
      ),
    };
  });

  const overall = sliceOf(startsInWindow, outcomesInWindow, now, completenessFor(plans, facts, {}));
  if (overall.terminal_n === 0 && backfillAttempts.length) {
    overall.degraded_reason = ['BACKFILL_ONLY'];
  }
  return {
    window_ms: windowMs,
    as_of: now.toISOString(),
    source,
    project,
    overall,
    backfill_n: backfillAttempts.length,
    window_attempt_ids: startsInWindow.map((a) => a.id),
  };
}

export async function loadHealthRows(db: StarDb) {
  const [attempts, outcomes, plans, facts] = await Promise.all([
    db.select().from(s.collectionAttempts),
    db.select().from(s.attemptOutcomes),
    db.select().from(s.collectionPlanItems),
    db.select().from(s.normalizedFacts),
  ]);
  return { attempts, outcomes, plans, facts };
}

export async function projectDeskHealth(db: StarDb, now = new Date(), windowMs = HEALTH_WINDOW_MS): Promise<DeskHealth> {
  const rows = await loadHealthRows(db);
  return projectHealthFromRows(rows.attempts, rows.outcomes, rows.plans, rows.facts, now, windowMs);
}

export function formatRate(value: number | null): string {
  if (value == null) return '无样本';
  return `${Math.round(value * 100)}%`;
}
