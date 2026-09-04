/**
 * M1 Recorder service — records market facts onto the D1 ledger.
 * Fact-only: no strategy signals, no parameter optimization, no wallet.
 * Every observation starts an attempt. Failures become outcomes; they are
 * never dropped. Non-ENABLED sources fail-closed onto the ledger.
 */
import type { StarDb } from '@/lib/db';
import { eq } from 'drizzle-orm';
import {
  classifyCollectError,
  completeFailure,
  completeSuccess,
  ensurePlanItem,
  startAttempt,
} from '@/lib/data/ledger';
import { assertSourceEnabled } from '@/lib/data/source-registry';
import type { ChainFact } from '@/lib/data/contract';
import * as schema from '@/db/schema';
import type { NewPoolBirth, PoolBookSnapshot, PriorityFeeObservation } from './types';
import { RECORDER_VERSION } from './types';

const SOURCE_FIXTURE = 'synthetic-fixtures';
const METHOD_BIRTH = 'm1:pool-birth';
const METHOD_BOOK = 'm1:pool-book';
const METHOD_FEE = 'm1:priority-fee';
const BLOCKED_SUBJECT = 'rec-source-denied';

export interface BirthRecord {
  attemptId: string;
  ok: boolean;
  outcome: string;
  receiptId: string | null;
  enteredDenominator: boolean;
}

export interface BookRecord {
  attemptId: string;
  ok: boolean;
  outcome: string;
  receiptId: string | null;
}

export interface FeeRecord {
  attemptId: string;
  ok: boolean;
  outcome: string;
  receiptId: string | null;
  sampleCount: number;
}

function resolveSourceId(source: string): string {
  return source === 'fixture' ? SOURCE_FIXTURE : source;
}

function isoOf(d: Date | string): Date {
  return typeof d === 'string' ? new Date(d) : d;
}

/** U-03: discovery objects are keyed by mint — ensure a minimal subject row. */
async function ensureMintSubject(db: StarDb, mint: string, firstSeenAt: Date): Promise<string> {
  const existing = await db.select().from(schema.projects).where(eq(schema.projects.id, mint)).limit(1);
  if (existing.length) return mint;
  const chains = await db.select().from(schema.chains).limit(1);
  const chainId = chains[0]?.id ?? 'solana';
  let narrative = (await db.select().from(schema.narratives).limit(1))[0];
  if (!narrative) {
    const nid = 'nar-unclassified';
    await db.insert(schema.narratives).values({
      id: nid, name: 'Unclassified (M1 discovery)', discoveredAt: firstSeenAt, updatedAt: firstSeenAt,
    });
    narrative = { id: nid } as typeof narrative;
  }
  await db.insert(schema.projects).values({
    id: mint, name: `mint:${mint.slice(0, 8)}`, symbol: mint.slice(0, 4).toUpperCase(),
    chainId, narrativeId: narrative.id, discoveredAt: firstSeenAt,
  });
  return mint;
}

/**
 * Market-fact adapter: M1 kinds sit outside the frozen research union.
 * Same documented cast precedent as the ledger backfill path.
 */
function asMarketFact(kind: string, payload: Record<string, unknown>, opts: {
  observedAt: string; slot: number | null; source: string;
}): ChainFact {
  return {
    kind: kind as ChainFact['kind'],
    contractVersion: 'solana-readonly@3',
    observedAt: opts.observedAt,
    slot: opts.slot,
    source: opts.source,
    sourceUrl: null,
    chainId: 'solana',
    mint: '11111111111111111111111111111111',
    payload: payload as unknown as ChainFact['payload'],
  };
}

async function beginAttempt(
  db: StarDb,
  args: {
    projectId: string;
    factKind: string;
    sourceId: string;
    methodId: string;
    observationKey: string;
    requestParams: Record<string, unknown>;
    startedAt: Date;
    plan?: boolean;
  },
) {
  const planItemId = args.plan
    ? await ensurePlanItem(db, {
        sourceId: args.sourceId,
        methodId: args.methodId,
        projectId: args.projectId,
        factKind: args.factKind,
      })
    : undefined;
  return startAttempt(db, {
    projectId: args.projectId,
    factKind: args.factKind,
    sourceId: args.sourceId,
    methodId: args.methodId,
    planItemId,
    observationKey: args.observationKey,
    requestParams: { ...args.requestParams, recorder: RECORDER_VERSION },
    startedAt: args.startedAt,
  });
}

async function failClosed(
  db: StarDb,
  attemptId: string,
  error: unknown,
): Promise<{ ok: false; attemptId: string; outcome: string; receiptId: null }> {
  await completeFailure(db, { attemptId, error });
  const classified = classifyCollectError(error);
  return { ok: false, attemptId, outcome: classified.outcome, receiptId: null };
}

/** Record a new-pool birth observation (U-03: keyed by mint across venues). */
export async function recordNewPoolBirth(
  db: StarDb,
  obs: Omit<NewPoolBirth, 'receiptId'>,
): Promise<BirthRecord> {
  const sourceId = resolveSourceId(obs.source);
  let subjectId = BLOCKED_SUBJECT;
  try {
    assertSourceEnabled(sourceId);
    if (obs.initialReserveSolEq < 0) throw new Error('invalid reserve');
    subjectId = await ensureMintSubject(db, obs.mint, new Date(obs.observedAt));
  } catch {
    subjectId = BLOCKED_SUBJECT;
  }
  const started = await beginAttempt(db, {
    projectId: subjectId,
    factKind: 'pool-birth',
    sourceId,
    methodId: METHOD_BIRTH,
    observationKey: `${METHOD_BIRTH}|${obs.dex}|${obs.poolAddress}|${RECORDER_VERSION}`,
    requestParams: { mint: obs.mint, dex: obs.dex, pool: obs.poolAddress },
    startedAt: isoOf(obs.observedAt),
    plan: true,
  });
  try {
    assertSourceEnabled(sourceId);
    if (obs.initialReserveSolEq < 0) throw new Error('invalid reserve');
    const { receiptId } = await completeSuccess(db, {
      attemptId: started.attemptId,
      observationKey: started.observationKey,
      projectId: subjectId,
      fact: asMarketFact('pool-birth', {
        recorder: RECORDER_VERSION,
        mint: obs.mint,
        dex: obs.dex,
        quoteAsset: obs.quoteAsset,
        poolAddress: obs.poolAddress,
        initialReserveSolEq: obs.initialReserveSolEq,
        slot: obs.slot,
      }, {
        observedAt: new Date(obs.observedAt).toISOString(),
        slot: obs.slot,
        source: sourceId,
      }),
      completedAt: isoOf(obs.observedAt),
    });
    return {
      attemptId: started.attemptId,
      ok: true,
      outcome: 'SUCCESS',
      receiptId,
      enteredDenominator: obs.initialReserveSolEq >= 8,
    };
  } catch (error) {
    const failed = await failClosed(db, started.attemptId, error);
    return { ...failed, enteredDenominator: false };
  }
}

/** Record a point-in-time pool book snapshot (E-03 inputs). */
export async function recordPoolBook(
  db: StarDb,
  obs: Omit<PoolBookSnapshot, 'receiptId'>,
): Promise<BookRecord> {
  const sourceId = resolveSourceId(obs.source);
  let subjectId = BLOCKED_SUBJECT;
  try {
    assertSourceEnabled(sourceId);
    subjectId = await ensureMintSubject(db, obs.mint, new Date(obs.observedAt));
  } catch {
    subjectId = BLOCKED_SUBJECT;
  }
  const started = await beginAttempt(db, {
    projectId: subjectId,
    factKind: 'pool-book',
    sourceId,
    methodId: METHOD_BOOK,
    observationKey: `${METHOD_BOOK}|${obs.poolAddress}|${obs.slot}|${RECORDER_VERSION}`,
    requestParams: { mint: obs.mint, pool: obs.poolAddress, slot: obs.slot },
    startedAt: isoOf(obs.observedAt),
    plan: true,
  });
  try {
    assertSourceEnabled(sourceId);
    const { receiptId } = await completeSuccess(db, {
      attemptId: started.attemptId,
      observationKey: started.observationKey,
      projectId: subjectId,
      fact: asMarketFact('pool-book', {
        recorder: RECORDER_VERSION,
        mint: obs.mint,
        poolAddress: obs.poolAddress,
        quoteReserveSol: obs.quoteReserveSol,
        baseReserveRaw: obs.baseReserveRaw,
        slot: obs.slot,
      }, {
        observedAt: new Date(obs.observedAt).toISOString(),
        slot: obs.slot,
        source: sourceId,
      }),
      completedAt: isoOf(obs.observedAt),
    });
    return { attemptId: started.attemptId, ok: true, outcome: 'SUCCESS', receiptId };
  } catch (error) {
    return failClosed(db, started.attemptId, error);
  }
}

/**
 * Record a batch of priority-fee observations as one fact (per-slot samples
 * inside a single receipt; downstream consumers compute p75 over N=150).
 */
export async function recordPriorityFeeWindow(
  db: StarDb,
  obs: Array<Omit<PriorityFeeObservation, 'receiptId'>>,
): Promise<FeeRecord> {
  if (obs.length === 0) throw new Error('priority-fee window requires ≥1 sample');
  const first = obs[0];
  const sourceId = resolveSourceId(first.source);
  const slots = obs.map((o) => o.slot);
  const minSlot = Math.min(...slots);
  const maxSlot = Math.max(...slots);
  let subjectId = BLOCKED_SUBJECT;
  try {
    assertSourceEnabled(sourceId);
    subjectId = await ensureMintSubject(db, `network:${minSlot}-${maxSlot}`, new Date(first.observedAt));
  } catch {
    subjectId = BLOCKED_SUBJECT;
  }
  const started = await beginAttempt(db, {
    projectId: subjectId,
    factKind: 'priority-fee',
    sourceId,
    methodId: METHOD_FEE,
    observationKey: `${METHOD_FEE}|${minSlot}-${maxSlot}|${RECORDER_VERSION}`,
    requestParams: { window: [minSlot, maxSlot], metric: first.feeMetric },
    startedAt: isoOf(first.observedAt),
    plan: true,
  });
  try {
    assertSourceEnabled(sourceId);
    const { receiptId } = await completeSuccess(db, {
      attemptId: started.attemptId,
      observationKey: started.observationKey,
      projectId: subjectId,
      fact: asMarketFact('priority-fee', {
        recorder: RECORDER_VERSION,
        feeMetric: first.feeMetric,
        samples: obs.map((o) => ({ slot: o.slot, feeLamports: o.feeLamports })),
      }, {
        observedAt: new Date(first.observedAt).toISOString(),
        slot: minSlot,
        source: sourceId,
      }),
      completedAt: isoOf(first.observedAt),
    });
    return {
      attemptId: started.attemptId,
      ok: true,
      outcome: 'SUCCESS',
      receiptId,
      sampleCount: obs.length,
    };
  } catch (error) {
    const failed = await failClosed(db, started.attemptId, error);
    return { ...failed, sampleCount: 0 };
  }
}
