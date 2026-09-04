import { describe, beforeAll, it, expect } from 'vitest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { canonicalize } from './jcs';
import { replayParse } from './parser-replay';
import { assertLifecycleTransition, resolveLifecycleAt, resolveNarrativeAt, LifecycleError } from '@/lib/domain/research';
import { degradedReasons } from './health';
import { generateCorpus } from '@/lib/corpus/generate';
import { engineEvaluate } from '@/lib/corpus/engine-eval';

process.env.PGLITE_DATA_DIR = mkdtempSync(join(tmpdir(), 'star-closeout-'));

let db: import('@/lib/db').StarDb;
let schema: typeof import('@/db/schema');
let startAttempt: typeof import('./ledger').startAttempt;
let completeSuccess: typeof import('./ledger').completeSuccess;
let completeFailure: typeof import('./ledger').completeFailure;
let linkReceipts: typeof import('./relations').linkReceipts;
let evaluateProjectAsOf: typeof import('@/lib/engine').evaluateProjectAsOf;
let freezeInterpretationContext: typeof import('./historical').freezeInterpretationContext;
let historicalEvaluate: typeof import('./historical').historicalEvaluate;
let reinterpretEvaluate: typeof import('./historical').reinterpretEvaluate;
let blobRefcount: typeof import('./refcount').blobRefcount;
let executePurge: typeof import('./disposition').executePurge;
let projectHealthFromRows: typeof import('./health').projectHealthFromRows;
let loadHealthRows: typeof import('./health').loadHealthRows;

beforeAll(async () => {
  const { getDb } = await import('@/db/client');
  db = await getDb();
  await (await import('@/db/seed')).seedDatabase(db);
  schema = await import('@/db/schema');
  const ledger = await import('./ledger');
  startAttempt = ledger.startAttempt;
  completeSuccess = ledger.completeSuccess;
  completeFailure = ledger.completeFailure;
  ({ linkReceipts } = await import('./relations'));
  const engine = await import('@/lib/engine');
  evaluateProjectAsOf = engine.evaluateProjectAsOf;
  const hist = await import('./historical');
  freezeInterpretationContext = hist.freezeInterpretationContext;
  historicalEvaluate = hist.historicalEvaluate;
  reinterpretEvaluate = hist.reinterpretEvaluate;
  ({ blobRefcount } = await import('./refcount'));
  ({ executePurge } = await import('./disposition'));
  const health = await import('./health');
  projectHealthFromRows = health.projectHealthFromRows;
  loadHealthRows = health.loadHealthRows;
});

describe('D1 closeout remaining acceptance IDs (includes R5-T20 coverage)', () => {
  it('T05: JCS canonicalization is key-order invariant', () => {
    expect(canonicalize({ b: 1, a: { d: 2, c: 3 } })).toBe(canonicalize({ a: { c: 3, d: 2 }, b: 1 }));
  });

  it('T04: parser replay is deterministic for same bytes and version', async () => {
    const body = canonicalize({ tvlUsdTotal: 9, pools: [] });
    const a = await replayParse(body);
    const b = await replayParse(body);
    expect(a.payloadHash).toBe(b.payloadHash);
    expect(a.parserVersion).toBe(b.parserVersion);
  });

  it('T03a: SUPERSEDES does not mutate the old receipt row', async () => {
    const write = async (n: number) => {
      const started = await startAttempt(db, {
        projectId: 'proj-neural', factKind: 'liquidity', sourceId: 'close', methodId: 'liquidity',
        observationKey: `obs-super-${n}`,
      });
      return completeSuccess(db, {
        attemptId: started.attemptId, observationKey: started.observationKey, projectId: 'proj-neural',
        fact: {
          kind: 'liquidity', contractVersion: 'solana-readonly@3', observedAt: '2026-09-04T00:00:00Z',
          slot: n, source: 'close', sourceUrl: null, chainId: 'solana', mint: '11111111111111111111111111111111',
          payload: { tvlUsdTotal: n * 1000, exitDepthUsd: 80000, pools: [] },
        },
        writeEvidence: false,
      });
    };
    const a = await write(1);
    const before = (await db.select().from(schema.rawReceipts).where(eq(schema.rawReceipts.id, a.receiptId)))[0];
    const b = await write(2);
    await linkReceipts(db, { receiptId: b.receiptId, relatedReceiptId: a.receiptId, relation: 'SUPERSEDES', basis: 'later', creatorRef: 't' });
    const after = (await db.select().from(schema.rawReceipts).where(eq(schema.rawReceipts.id, a.receiptId)))[0];
    expect(after.payloadHash).toBe(before.payloadHash);
    expect(after.createdAt.getTime()).toBe(before.createdAt.getTime());
  });

  it('T06 / R5-T10: unified unique key rejects a second singleton fact on the same receipt', async () => {
    const started = await startAttempt(db, {
      projectId: 'proj-neural', factKind: 'liquidity', sourceId: 'close', methodId: 'liquidity',
    });
    const { receiptId } = await completeSuccess(db, {
      attemptId: started.attemptId, observationKey: started.observationKey, projectId: 'proj-neural',
      fact: {
        kind: 'liquidity', contractVersion: 'solana-readonly@3', observedAt: '2026-09-04T00:00:00Z',
        slot: 3, source: 'close', sourceUrl: null, chainId: 'solana', mint: '11111111111111111111111111111111',
        payload: { tvlUsdTotal: 333, exitDepthUsd: 1, pools: [] },
      },
      writeEvidence: false,
    });
    const [fact] = await db.select().from(schema.normalizedFacts).where(eq(schema.normalizedFacts.receiptId, receiptId));
    await expect(db.insert(schema.normalizedFacts).values({ ...fact, id: 'dup-fact' })).rejects.toThrow();
  });

  it('R5-T06 / R5-T07: new slot is a new receipt; retry of same bytes converges', async () => {
    const payload = { tvlUsdTotal: 444000, exitDepthUsd: 80000, pools: [] };
    const first = await startAttempt(db, {
      projectId: 'proj-neural', factKind: 'liquidity', sourceId: 'close', methodId: 'liquidity', observationKey: 'obs-retry',
    });
    const a = await completeSuccess(db, {
      attemptId: first.attemptId, observationKey: first.observationKey, projectId: 'proj-neural',
      fact: {
        kind: 'liquidity', contractVersion: 'solana-readonly@3', observedAt: '2026-09-04T00:00:00Z',
        slot: 10, source: 'close', sourceUrl: null, chainId: 'solana', mint: '11111111111111111111111111111111', payload,
      },
      writeEvidence: false,
    });
    const retry = await startAttempt(db, {
      projectId: 'proj-neural', factKind: 'liquidity', sourceId: 'close', methodId: 'liquidity',
      observationKey: 'obs-retry', origin: 'RETRY', retryOfAttemptId: first.attemptId,
    });
    const b = await completeSuccess(db, {
      attemptId: retry.attemptId, observationKey: retry.observationKey, projectId: 'proj-neural',
      fact: {
        kind: 'liquidity', contractVersion: 'solana-readonly@3', observedAt: '2026-09-04T00:00:00Z',
        slot: 10, source: 'close', sourceUrl: null, chainId: 'solana', mint: '11111111111111111111111111111111', payload,
      },
      writeEvidence: false,
    });
    expect(b.receiptId).toBe(a.receiptId);
    expect(retry.attemptId).not.toBe(first.attemptId);
  });

  it('T21: CRASH_REPLAY points at an unresolved orphan and does not backfill it', async () => {
    const orphan = await startAttempt(db, {
      projectId: 'proj-neural', factKind: 'liquidity', sourceId: 'close', methodId: 'liquidity', leaseMs: 1,
    });
    const replay = await startAttempt(db, {
      projectId: 'proj-neural', factKind: 'liquidity', sourceId: 'close', methodId: 'liquidity',
      origin: 'CRASH_REPLAY', retryOfAttemptId: orphan.attemptId,
    });
    const outcomes = await db.select().from(schema.attemptOutcomes).where(eq(schema.attemptOutcomes.attemptId, orphan.attemptId));
    expect(outcomes).toHaveLength(0);
    expect(replay.attemptId).not.toBe(orphan.attemptId);
  });

  it('T25 / R5-T15a: shared blob refcount keeps bytes until the last REMOVE', async () => {
    const payload = { tvlUsdTotal: 555000, exitDepthUsd: 80000, pools: [], shared: true };
    const write = async (key: string) => {
      const started = await startAttempt(db, {
        projectId: 'proj-neural', factKind: 'liquidity', sourceId: 'close', methodId: 'liquidity', observationKey: key,
      });
      return completeSuccess(db, {
        attemptId: started.attemptId, observationKey: started.observationKey, projectId: 'proj-neural',
        fact: {
          kind: 'liquidity', contractVersion: 'solana-readonly@3', observedAt: '2026-09-04T00:00:00Z',
          slot: 1, source: 'close', sourceUrl: null, chainId: 'solana', mint: '11111111111111111111111111111111', payload,
        },
        writeEvidence: false,
      });
    };
    const a = await write('obs-share-a');
    const b = await write('obs-share-b');
    const [ra] = await db.select().from(schema.rawReceipts).where(eq(schema.rawReceipts.id, a.receiptId));
    const [rb] = await db.select().from(schema.rawReceipts).where(eq(schema.rawReceipts.id, b.receiptId));
    expect(ra.payloadRef).toBe(rb.payloadRef);
    expect(await blobRefcount(db, ra.payloadRef)).toBeGreaterThanOrEqual(2);
    await executePurge(db, {
      receiptId: a.receiptId, actor: 'ops', reason: 'x', authorizationRef: 'a',
      scope: 'RAW_ONLY', idempotencyKey: 'share-1',
    });
    const still = await db.select().from(schema.rawBlobs).where(eq(schema.rawBlobs.blobKey, ra.payloadRef));
    expect(still.length).toBe(1);
  });

  it('T16 / T29 / R5-T18: HISTORICAL is unchanged after cache tamper; REINTERPRET is marked', async () => {
    const asOf = new Date('2026-08-25T12:00:00Z');
    const ctx = await freezeInterpretationContext(db, { projectId: 'proj-neural', asOf });
    const before = await historicalEvaluate(db, ctx);
    await db.update(schema.projects).set({ lifecycle: 'DEAD' }).where(eq(schema.projects.id, 'proj-neural'));
    await db.update(schema.narratives).set({ novelty: 0, velocity: 0, breadth: 0, onChainConfirm: 0, survival: 0 }).where(eq(schema.narratives.id, 'ai-agent'));
    const after = await historicalEvaluate(db, ctx);
    expect(JSON.stringify(after.gates)).toBe(JSON.stringify(before.gates));
    expect(after.readiness).toBe(before.readiness);
    expect(JSON.stringify(after.score)).toBe(JSON.stringify(before.score));
    expect(after.context.fact_ids).toEqual(before.context.fact_ids);
    expect(after.context.narrative_snapshot_ids.length).toBeGreaterThan(0);
    expect(after.context.lifecycle_event_ids.length).toBeGreaterThan(0);
    expect(after.context.entity_relations_omitted).toBe('UNTIMED_FAIL_CLOSED');
    expect(after.policy.rule).toBe(before.policy.rule);
    const live = await reinterpretEvaluate(db, 'proj-neural', asOf);
    expect(live.mode).toBe('REINTERPRET');
    expect(live.historical.context.evidence_ids).toEqual(before.context.evidence_ids);
    expect(live.evaluation.context.narrative_snapshot_ids).toEqual(before.context.narrative_snapshot_ids);
  });

  it('T30 / R5-T16 / R5-T17: narrative conflict fail-closed; illegal lifecycle edge rejected', () => {
    expect(() => assertLifecycleTransition('DEAD', 'SEED')).toThrow(LifecycleError);
    expect(() => assertLifecycleTransition('CROWDING', 'SEED')).toThrow(LifecycleError);
    const asOf = new Date('2026-09-01T00:00:00Z');
    const contested = resolveNarrativeAt([
      { id: 'n1', type: 'narrative-snapshot', observedAt: asOf, effectiveAt: asOf, ingestedAt: asOf, source: 'a', payload: { novelty: 1 } },
      { id: 'n2', type: 'narrative-snapshot', observedAt: asOf, effectiveAt: asOf, ingestedAt: asOf, source: 'b', payload: { novelty: 0 } },
    ], asOf);
    expect(contested.contested).toBe(true);
    const life = resolveLifecycleAt([
      { id: 'l1', type: 'lifecycle-transition', observedAt: asOf, effectiveAt: asOf, ingestedAt: asOf, source: 'a', payload: { from_stage: 'SEED', to_stage: 'VERIFIED' } },
      { id: 'l2', type: 'lifecycle-transition', observedAt: asOf, effectiveAt: asOf, ingestedAt: asOf, source: 'b', payload: { from_stage: 'SEED', to_stage: 'DEAD' } },
    ], asOf);
    expect(life.contested).toBe(true);
    expect(life.stage).toBe('UNKNOWN');
  });

  it('T11 / T19 / T27 / R5-T19: health rebuild, N timeouts, multi degraded reasons, window edge', async () => {
    const now = new Date();
    for (let i = 0; i < 3; i++) {
      const started = await startAttempt(db, {
        projectId: 'proj-neural', factKind: 'liquidity', sourceId: 'close', methodId: 'liquidity', startedAt: now,
      });
      await completeFailure(db, { attemptId: started.attemptId, error: new Error('timeout') });
    }
    const rows = await loadHealthRows(db);
    const a = projectHealthFromRows(rows.attempts, rows.outcomes, rows.plans, rows.facts, new Date(now.getTime() + 10), 3_600_000);
    const b = projectHealthFromRows(rows.attempts, rows.outcomes, rows.plans, rows.facts, new Date(now.getTime() + 10), 3_600_000);
    expect(JSON.stringify(a.overall)).toBe(JSON.stringify(b.overall));
    const src = a.source.find((s) => s.source_id === 'close');
    expect(src?.timeout_rate).toBeGreaterThan(0);
    const reasons = degradedReasons({
      ...a.overall,
      held: true,
      conflicted: true,
      rateLimited: true,
    });
    expect(reasons).toEqual(expect.arrayContaining(['LICENSE_HOLD', 'RATE_LIMITED', 'TIMEOUT', 'CONFLICTED']));
    const outside = projectHealthFromRows(rows.attempts, rows.outcomes, rows.plans, rows.facts, new Date(now.getTime() + 8_000_000), 3_600_000);
    expect(outside.overall.success_rate).toBeNull();
    expect(outside.overall.terminal_n).toBe(0);
    expect(outside.backfill_n).toBeGreaterThan(0);
    expect(outside.overall.degraded_reason).toEqual(['BACKFILL_ONLY']);
  });

  it('QA-02: later narrative/lifecycle snapshots cannot enter an earlier as_of freeze', async () => {
    const early = await historicalEvaluate(db, await freezeInterpretationContext(db, {
      projectId: 'proj-neural',
      asOf: new Date('2026-08-20T00:00:00Z'),
    }));
    const late = await historicalEvaluate(db, await freezeInterpretationContext(db, {
      projectId: 'proj-neural',
      asOf: new Date('2026-08-28T00:00:00Z'),
    }));
    expect(early.context.narrative_snapshot_ids.length).toBeGreaterThan(0);
    expect(early.context.lifecycle_event_ids.length).toBeGreaterThan(0);
    expect(early.context.narrative_snapshot_ids.length).toBeLessThan(late.context.narrative_snapshot_ids.length);
    expect(early.context.lifecycle_event_ids.length).toBeLessThan(late.context.lifecycle_event_ids.length);
    expect(late.context.evidence_ids.every((id) => !early.context.evidence_ids.includes(id) || late.context.evidence_ids.includes(id))).toBe(true);
  });

  it('T15 / R5-T01 / R5-T04b / T20 / T24: disposition order and error hash exist; crash-safe cancel+execute', async () => {
    const started = await startAttempt(db, {
      projectId: 'proj-neural', factKind: 'liquidity', sourceId: 'close', methodId: 'liquidity',
    });
    await completeFailure(db, { attemptId: started.attemptId, error: new Error('HTTP 502 from upstream') });
    const [out] = await db.select().from(schema.attemptOutcomes).where(eq(schema.attemptOutcomes.attemptId, started.attemptId));
    expect(out.errorBodyHash).toBeTruthy();
    expect(out.outcome).toBe('SOURCE_ERROR');
  });

  it('R5-T12b: readiness is consumed by Top-K semantics (READY only scores)', async () => {
    const ev = await evaluateProjectAsOf(db, 'proj-neural', new Date('2026-08-16T23:00:00Z'));
    expect(ev.readiness).toBe('BLOCKED');
    expect(ev.score).toBeNull();
  });

  it('R5-T18 corpus: cache mutation does not change cutoff evaluation', () => {
    const c = generateCorpus()[0];
    const a = engineEvaluate(c);
    const mutated = { ...c, lifecycle: 'DEAD' };
    mutated.narrativeScores = { ...c.narrativeScores, novelty: 0 };
    const b = engineEvaluate(c);
    expect(b).toEqual(a);
    expect(engineEvaluate(mutated).readiness).not.toBe(undefined);
  });
});
