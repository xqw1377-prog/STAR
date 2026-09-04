import type { StarDb } from '@/lib/db';
import * as s from '@/db/schema';
import type { LatencyReport } from './types';

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - i) + sorted[hi] * (i - lo);
}

/** Live attempts only. Backfill is excluded from real-time latency. */
export async function latencyFromLedger(db: StarDb): Promise<LatencyReport> {
  const attempts = await db.select().from(s.collectionAttempts);
  const outcomes = await db.select().from(s.attemptOutcomes);
  const byAttempt = new Map(outcomes.map((o) => [o.attemptId, o]));
  const samples: number[] = [];
  for (const a of attempts) {
    if (a.timingQuality !== 'LIVE') continue;
    const o = byAttempt.get(a.id);
    if (!o) continue;
    samples.push(o.completedAt.getTime() - a.startedAt.getTime());
  }
  samples.sort((x, y) => x - y);
  if (!samples.length) return { n: 0, p50Ms: null, p95Ms: null, liveOnly: true };
  return {
    n: samples.length,
    p50Ms: quantile(samples, 0.5),
    p95Ms: quantile(samples, 0.95),
    liveOnly: true,
  };
}
