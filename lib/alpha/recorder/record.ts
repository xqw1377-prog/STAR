import type { StarDb } from '@/lib/db';
import { assertSourceEnabled } from '@/lib/data/source-registry';
import { classifyCollectError, completeFailure, completeObservation, ensurePlanItem, startAttempt } from '@/lib/data/ledger';
import { COLLECTOR_VERSION, UNIVERSE_POLICY_ID } from './version';
import type { NewPoolBirth, PoolBookSnapshot, RecordOutcome } from './types';

function projectIdFor(mint: string): string {
  return `rec-${mint.slice(0, 24)}`;
}

function enabledSourceId(source: NewPoolBirth['source']): string {
  return source === 'fixture' ? 'synthetic-fixtures' : 'solana-rpc';
}

async function appendObservation(
  db: StarDb,
  args: {
    kind: string;
    mint: string;
    source: NewPoolBirth['source'];
    observedAt: string;
    slot: number | null;
    payload: Record<string, unknown>;
    extraParams?: Record<string, unknown>;
    timingQuality?: 'LIVE' | 'BACKFILLED_UNKNOWN';
    completedAt?: Date;
    validate?: () => void;
  },
): Promise<RecordOutcome> {
  const projectId = projectIdFor(args.mint);
  const sourceId = enabledSourceId(args.source);
  const planItemId = await ensurePlanItem(db, {
    sourceId,
    methodId: args.kind,
    projectId,
    factKind: args.kind,
  });
  const started = await startAttempt(db, {
    projectId,
    factKind: args.kind,
    sourceId,
    methodId: args.kind,
    planItemId,
    timingQuality: args.timingQuality ?? 'LIVE',
    observationKey: `${sourceId}|${args.kind}|${args.mint}|${args.observedAt}|${COLLECTOR_VERSION}|${crypto.randomUUID()}`,
    requestParams: {
      mint: args.mint,
      collector_version: COLLECTOR_VERSION,
      universe_policy_id: UNIVERSE_POLICY_ID,
      ...args.extraParams,
    },
  });

  try {
    assertSourceEnabled(sourceId);
    args.validate?.();
    await completeObservation(db, {
      attemptId: started.attemptId,
      observationKey: started.observationKey,
      projectId,
      kind: args.kind,
      observedAt: new Date(args.observedAt),
      slot: args.slot,
      source: args.source,
      completedAt: args.completedAt,
      payload: {
        ...args.payload,
        collector_version: COLLECTOR_VERSION,
        universe_policy_id: UNIVERSE_POLICY_ID,
      },
    });
    return {
      mint: args.mint,
      attemptId: started.attemptId,
      ok: true,
      outcome: 'SUCCESS',
      detail: 'recorded',
      collectorVersion: COLLECTOR_VERSION,
    };
  } catch (error) {
    await completeFailure(db, { attemptId: started.attemptId, error });
    const classified = classifyCollectError(error);
    return {
      mint: args.mint,
      attemptId: started.attemptId,
      ok: false,
      outcome: classified.outcome,
      detail: classified.errorCode,
      collectorVersion: COLLECTOR_VERSION,
    };
  }
}

export async function recordNewPoolBirth(
  db: StarDb,
  birth: NewPoolBirth,
  opts?: { timingQuality?: 'LIVE' | 'BACKFILLED_UNKNOWN' },
): Promise<RecordOutcome> {
  const backfill = opts?.timingQuality === 'BACKFILLED_UNKNOWN';
  return appendObservation(db, {
    kind: 'new-pool-birth',
    mint: birth.mint,
    source: birth.source,
    observedAt: birth.observedAt,
    slot: birth.slot,
    extraParams: { dex: birth.dex },
    timingQuality: opts?.timingQuality,
    completedAt: backfill ? new Date(birth.observedAt) : undefined,
    validate: () => {
      if (birth.initialReserveSolEq < 0) throw new Error('invalid reserve');
    },
    payload: {
      mint: birth.mint,
      dex: birth.dex,
      quoteAsset: birth.quoteAsset,
      poolAddress: birth.poolAddress,
      initialReserveSolEq: birth.initialReserveSolEq,
      effectiveAt: birth.effectiveAt,
      raw_receipt: birth.rawReceipt,
    },
  });
}

export async function recordPoolBook(db: StarDb, book: PoolBookSnapshot): Promise<RecordOutcome> {
  return appendObservation(db, {
    kind: 'pool-book',
    mint: book.mint,
    source: book.source,
    observedAt: book.observedAt,
    slot: book.slot,
    extraParams: { poolAddress: book.poolAddress },
    validate: () => {
      if (book.quoteReserve < 0 || book.baseReserve < 0) throw new Error('invalid book');
    },
    payload: {
      mint: book.mint,
      poolAddress: book.poolAddress,
      quoteReserve: book.quoteReserve,
      baseReserve: book.baseReserve,
      effectiveAt: book.effectiveAt,
      raw_receipt: book.rawReceipt,
    },
  });
}
