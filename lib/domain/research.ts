/**
 * Independent selectors for NarrativeSnapshot and LifecycleTransition.
 * Must not reuse latestEvidenceByCheck (R5-16).
 */
export const LIFECYCLE_ORDER = [
  'SEED', 'IGNITION', 'VERIFIED', 'ACCELERATION', 'CROWDING', 'DISTRIBUTION', 'DEAD',
] as const;

export type ResearchRow = {
  id: string | number;
  type: string;
  observedAt: Date;
  effectiveAt: Date;
  ingestedAt: Date;
  source: string;
  payload: unknown;
};

export class LifecycleError extends Error {
  constructor(public readonly code: 'ILLEGAL_LIFECYCLE_EDGE' | 'LIFECYCLE_BREAK' | 'LIFECYCLE_CONFLICT', message: string) {
    super(message);
    this.name = 'LifecycleError';
  }
}

export function isForwardLifecycle(from: string, to: string): boolean {
  const a = LIFECYCLE_ORDER.indexOf(from as (typeof LIFECYCLE_ORDER)[number]);
  const b = LIFECYCLE_ORDER.indexOf(to as (typeof LIFECYCLE_ORDER)[number]);
  if (a < 0 || b < 0) return false;
  return b > a;
}

export function assertLifecycleTransition(from: string, to: string): void {
  if (from === to) return;
  if (from === 'DEAD') throw new LifecycleError('ILLEGAL_LIFECYCLE_EDGE', `${from}→${to}`);
  if (!isForwardLifecycle(from, to)) throw new LifecycleError('ILLEGAL_LIFECYCLE_EDGE', `${from}→${to}`);
}

function before(row: ResearchRow, asOf: Date): boolean {
  return row.observedAt <= asOf && row.effectiveAt <= asOf;
}

function sortKey(a: ResearchRow, b: ResearchRow): number {
  return a.effectiveAt.getTime() - b.effectiveAt.getTime()
    || a.observedAt.getTime() - b.observedAt.getTime()
    || a.ingestedAt.getTime() - b.ingestedAt.getTime()
    || String(a.id).localeCompare(String(b.id));
}

export function resolveLifecycleAt(rows: ResearchRow[], asOf: Date): { stage: string; contested: boolean } {
  const transitions = rows.filter((r) => r.type === 'lifecycle-transition' && before(r, asOf)).sort(sortKey);
  let stage = 'SEED';
  for (let i = 0; i < transitions.length; i++) {
    const payload = (transitions[i].payload ?? {}) as { stage?: string; from_stage?: string; to_stage?: string };
    const to = String(payload.to_stage ?? payload.stage ?? '');
    const from = String(payload.from_stage ?? stage);
    const twins = transitions.filter((t) => t.effectiveAt.getTime() === transitions[i].effectiveAt.getTime()
      && String(((t.payload ?? {}) as { from_stage?: string }).from_stage ?? stage) === from
      && t !== transitions[i]);
    if (twins.length) return { stage: 'UNKNOWN', contested: true };
    try {
      assertLifecycleTransition(from, to);
    } catch {
      return { stage: 'UNKNOWN', contested: true };
    }
    if (from !== stage && from !== 'SEED') return { stage: 'UNKNOWN', contested: true };
    stage = to;
  }
  return { stage, contested: false };
}

export function resolveNarrativeAt(rows: ResearchRow[], asOf: Date): { payload: Record<string, number> | null; contested: boolean } {
  const snaps = rows.filter((r) => r.type === 'narrative-snapshot' && before(r, asOf)).sort(sortKey);
  if (!snaps.length) return { payload: null, contested: false };
  const latestTime = snaps[snaps.length - 1].observedAt.getTime();
  const sameInstant = snaps.filter((s) => s.observedAt.getTime() === latestTime);
  const sources = new Set(sameInstant.map((s) => s.source));
  if (sources.size > 1) {
    const hashes = new Set(sameInstant.map((s) => JSON.stringify(s.payload)));
    if (hashes.size > 1) return { payload: null, contested: true };
  }
  const p = (sameInstant[sameInstant.length - 1].payload ?? {}) as Record<string, number>;
  return { payload: p, contested: false };
}
