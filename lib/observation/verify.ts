/**
 * M1 verification: recompute consistency from committed state alone.
 * A verified store can answer: watermark == highest processed, every batch's
 * data still present, every gap resolved or explicitly OPEN, every dead
 * letter carries its full original context.
 */
import { eq } from 'drizzle-orm';
import * as s from '@/db/schema';
import type { StarDb } from '@/lib/db';

export interface VerificationReport {
  ok: boolean;
  observations: number;
  deadLetters: number;
  batches: number;
  gapsOpen: number;
  gapsBackfilled: number;
  checkpoint: number | null;
  problems: string[];
}

export async function verifyObservationStore(db: StarDb, sourceId: string): Promise<VerificationReport> {
  const problems: string[] = [];
  const observations = await db.select().from(s.m1Observations).where(eq(s.m1Observations.sourceId, sourceId));
  const deadLetters = await db.select().from(s.m1DeadLetters).where(eq(s.m1DeadLetters.sourceId, sourceId));
  const batches = await db.select().from(s.m1Batches).where(eq(s.m1Batches.sourceId, sourceId));
  const gaps = await db.select().from(s.m1Gaps).where(eq(s.m1Gaps.sourceId, sourceId));
  const [checkpoint] = await db.select().from(s.m1Checkpoint).where(eq(s.m1Checkpoint.sourceId, sourceId));

  // 1. Watermark == highest fully processed slot (observations + dead letters).
  const processedSlots = [
    ...observations.map((o) => o.slot),
    ...deadLetters.map((d) => d.slot).filter((x): x is number => x != null),
  ];
  const maxProcessed = processedSlots.length ? Math.max(...processedSlots) : null;
  if (checkpoint && maxProcessed != null && checkpoint.highestFullyProcessedSlot !== maxProcessed) {
    problems.push(`checkpoint ${checkpoint.highestFullyProcessedSlot} != max processed slot ${maxProcessed}`);
  }

  // 2. Every observation belongs to a committed batch.
  const batchIds = new Set(batches.map((b) => b.id));
  for (const o of observations) {
    if (!batchIds.has(o.batchId)) problems.push(`observation ${o.observationKey} references unknown batch ${o.batchId}`);
  }

  // 3. Batch counts must match reality (committed rows per batch).
  for (const b of batches) {
    const actual = observations.filter((o) => o.batchId === b.id).length;
    if (actual !== b.observationCount) problems.push(`batch ${b.id} claims ${b.observationCount} observations, found ${actual}`);
  }

  // 4. Observation keys unique (idempotency held).
  const keys = new Set(observations.map((o) => o.observationKey));
  if (keys.size !== observations.length) problems.push('duplicate observation keys present (idempotency broken)');

  // 5. Dead letters carry full context.
  for (const d of deadLetters) {
    if (!d.stage || !d.error || d.rawPayload == null || d.firstSeenAt == null) {
      problems.push(`dead letter ${d.id} missing context (stage/error/raw/first_seen_at)`);
    }
  }

  // 6. Gaps are explicit: every gap row is OPEN or BACKFILLED with a batch ref.
  for (const g of gaps) {
    if (g.status === 'BACKFILLED' && !g.backfillBatchId) problems.push(`gap ${g.id} BACKFILLED without backfill batch`);
    if (g.toSlot < g.fromSlot) problems.push(`gap ${g.id} inverted range`);
  }

  return {
    ok: problems.length === 0,
    observations: observations.length,
    deadLetters: deadLetters.length,
    batches: batches.length,
    gapsOpen: gaps.filter((g) => g.status === 'OPEN').length,
    gapsBackfilled: gaps.filter((g) => g.status === 'BACKFILLED').length,
    checkpoint: checkpoint?.highestFullyProcessedSlot ?? null,
    problems,
  };
}
