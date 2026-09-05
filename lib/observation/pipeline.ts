/**
 * The SINGLE pipeline. Live, capture and replay all call runPipelineBatch —
 * there is no second code path, so "same input → same observations" holds by
 * construction and is asserted by the M1 acceptance tests.
 *
 * Batch commit is atomic: observations + dead letters + gap rows + batch row
 * + checkpoint advance land in ONE transaction. The checkpoint can therefore
 * never be ahead of the data, nor behind it (poison envelopes dead-letter and
 * still advance the watermark — they are terminal, not blocking).
 */
import { and, eq, inArray } from 'drizzle-orm';
import * as s from '@/db/schema';
import type { StarDb } from '@/lib/db';
import { newLedgerId } from '@/lib/data/hash';
import { decode, ObservationRejection, type Observation, type ObservationEnvelope, type ObservationMode } from './contract';
import { processEnvelope } from './decode';

export interface BatchResult {
  batchId: string;
  mode: ObservationMode;
  committed: number;
  duplicated: number;
  deadLettered: number;
  gapsOpened: Array<{ fromSlot: number; toSlot: number }>;
  gapsBackfilled: number;
  checkpoint: number;
}

async function readCheckpoint(db: StarDb, sourceId: string): Promise<number> {
  const [row] = await db.select().from(s.m1Checkpoint).where(eq(s.m1Checkpoint.sourceId, sourceId));
  return row?.highestFullyProcessedSlot ?? -1;
}

function deadLetterOf(id: string, sourceId: string, slot: number | null | undefined, signature: string | null | undefined, stage: string, error: string, raw: Record<string, unknown>): typeof s.m1DeadLetters.$inferInsert {
  return {
    id,
    sourceId,
    slot: slot ?? null,
    signature: signature ?? null,
    observationKey: null,
    stage,
    error,
    rawHash: null,
    rawPayload: raw,
    firstSeenAt: new Date(),
    retryCount: 0,
  };
}

/** The one and only pipeline entry point. All modes route here. */
export async function runPipelineBatch(db: StarDb, input: { sourceId: string; mode: ObservationMode; envelopes: ObservationEnvelope[] }): Promise<BatchResult> {
  const batchId = newLedgerId('m1batch');
  const accepted: Observation[] = [];
  const deadLetters: Array<typeof s.m1DeadLetters.$inferInsert> = [];

  for (const raw of input.envelopes) {
    try {
      const envelope = decode(raw);
      accepted.push(await processEnvelope(envelope, input.mode));
    } catch (err) {
      if (err instanceof ObservationRejection) {
        deadLetters.push(deadLetterOf(newLedgerId('m1dlq'), raw.sourceId || input.sourceId, raw.slot, raw.signature, err.stage, err.message, (raw?.raw ?? raw) as Record<string, unknown>));
        continue;
      }
      throw err;
    }
  }

  const before = await readCheckpoint(db, input.sourceId);
  // Watermark inputs: committed observations + terminally dispositioned
  // dead letters whose slot survived decode (interpret/normalize failures).
  // Decode-stage failures carry an unvalidated slot claim and never advance
  // the watermark; interpret/normalize poisons are terminal (DLQ) and MUST
  // advance it, or one malformed envelope would block the stream forever.
  const watermarkSlots = [
    ...accepted.map((o) => o.slot),
    ...deadLetters.filter((d) => d.stage !== 'decode').map((d) => d.slot).filter((x): x is number => x != null),
  ];
  const maxIncoming = watermarkSlots.length ? Math.max(...watermarkSlots) : before;

  // Idempotency pre-check: keys already committed count as duplicates.
  const keys = accepted.map((o) => o.observationKey);
  const existing = keys.length
    ? await db.select({ key: s.m1Observations.observationKey }).from(s.m1Observations).where(inArray(s.m1Observations.observationKey, keys))
    : [];
  const existingKeys = new Set(existing.map((r) => r.key));
  const fresh = accepted.filter((o) => !existingKeys.has(o.observationKey));

  let gapsOpened: Array<{ fromSlot: number; toSlot: number }> = [];
  let gapsBackfilled = 0;

  await db.transaction(async (tx) => {
    for (const o of fresh) {
      await tx.insert(s.m1Observations).values({
        id: newLedgerId('m1obs'),
        observationKey: o.observationKey,
        sourceId: o.sourceId,
        mode: o.mode,
        slot: o.slot,
        signature: o.signature,
        instructionIndex: o.instructionIndex,
        kind: o.kind,
        rawHash: o.rawHash,
        rawPayload: o.rawPayload,
        normalized: o.normalized,
        observedAt: new Date(o.observedAt),
        ingestedAt: new Date(),
        batchId,
      }).onConflictDoNothing();
    }
    for (const d of deadLetters) {
      await tx.insert(s.m1DeadLetters).values(d);
    }

    // Gap detection: a complete-stream source jumping past checkpoint+1 is an
    // explicit coverage hole — recorded, never silently treated as empty.
    // The very first batch establishes the baseline (before === -1): slots
    // prior to the observer's start are not gaps. Intra-batch holes between
    // envelopes of one batch are intentionally not split here — gap semantics
    // are watermark-relative (same simplification documented in tests).
    const nextExpected = before + 1;
    if (before >= 0 && maxIncoming > nextExpected) {
      gapsOpened = [{ fromSlot: nextExpected, toSlot: maxIncoming - 1 }];
      await tx.insert(s.m1Gaps).values({
        id: newLedgerId('m1gap'),
        sourceId: input.sourceId,
        fromSlot: nextExpected,
        toSlot: maxIncoming - 1,
        detectedAt: new Date(),
        status: 'OPEN',
        backfillBatchId: null,
      });
    }

    // Gap recovery: any OPEN gap now covered by incoming slots is backfilled.
    const openGaps = await tx.select().from(s.m1Gaps).where(and(eq(s.m1Gaps.sourceId, input.sourceId), eq(s.m1Gaps.status, 'OPEN')));
    for (const gap of openGaps) {
      const landed = fresh.some((o) => o.slot >= gap.fromSlot && o.slot <= gap.toSlot);
      if (landed) {
        await tx.update(s.m1Gaps).set({ status: 'BACKFILLED', backfillBatchId: batchId }).where(eq(s.m1Gaps.id, gap.id));
        gapsBackfilled += 1;
      }
    }

    // Batch row + watermark: same transaction as the data itself.
    if (fresh.length > 0 || deadLetters.length > 0) {
      await tx.insert(s.m1Batches).values({
        id: batchId,
        sourceId: input.sourceId,
        mode: input.mode,
        fromSlot: fresh.length ? Math.min(...fresh.map((o) => o.slot)) : (deadLetters[0]?.slot ?? maxIncoming),
        toSlot: maxIncoming,
        observationCount: fresh.length,
        deadLetterCount: deadLetters.length,
        committedAt: new Date(),
      });
      if (maxIncoming > before) {
        await tx
          .insert(s.m1Checkpoint)
          .values({ id: 1, sourceId: input.sourceId, highestFullyProcessedSlot: maxIncoming, updatedAt: new Date() })
          .onConflictDoUpdate({
            target: s.m1Checkpoint.id,
            set: { highestFullyProcessedSlot: maxIncoming, updatedAt: new Date() },
          });
      }
    }
  });

  return {
    batchId,
    mode: input.mode,
    committed: fresh.length,
    duplicated: accepted.length - fresh.length,
    deadLettered: deadLetters.length,
    gapsOpened,
    gapsBackfilled,
    checkpoint: Math.max(before, maxIncoming),
  };
}
