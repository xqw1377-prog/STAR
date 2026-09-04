import { describe, beforeAll, it, expect } from 'vitest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { eq } from 'drizzle-orm';

process.env.PGLITE_DATA_DIR = mkdtempSync(join(tmpdir(), 'star-ledger-'));

let db: import('@/lib/db').StarDb;
let schema: typeof import('@/db/schema');
let startAttempt: typeof import('./ledger').startAttempt;
let completeSuccess: typeof import('./ledger').completeSuccess;
let completeFailure: typeof import('./ledger').completeFailure;
let ensurePlanItem: typeof import('./ledger').ensurePlanItem;
let ContractViolation: typeof import('./contract').ContractViolation;

beforeAll(async () => {
  const { getDb } = await import('@/db/client');
  db = await getDb();
  const { seedDatabase } = await import('@/db/seed');
  await seedDatabase(db);
  schema = await import('@/db/schema');
  const ledger = await import('./ledger');
  startAttempt = ledger.startAttempt;
  completeSuccess = ledger.completeSuccess;
  completeFailure = ledger.completeFailure;
  ensurePlanItem = ledger.ensurePlanItem;
  ({ ContractViolation } = await import('./contract'));
});

const fact = (kind: 'mint-authority' | 'liquidity' = 'liquidity') => ({
  kind,
  contractVersion: 'solana-readonly@3',
  observedAt: '2026-09-04T00:00:00Z',
  slot: 1,
  source: 'fixture',
  sourceUrl: null,
  chainId: 'solana' as const,
  mint: '11111111111111111111111111111111',
  payload: kind === 'liquidity'
    ? { tvlUsdTotal: 1, exitDepthUsd: 1, pools: [] }
    : { mintAuthority: null, freezeAuthority: null, token2022Extensions: [] },
});

describe('D1-A ledger', () => {
  it('T14: N requests write N attempts (never deduped)', async () => {
    const before = (await db.select().from(schema.collectionAttempts)).length;
    for (let i = 0; i < 3; i++) {
      const started = await startAttempt(db, {
        projectId: 'proj-neural',
        factKind: 'liquidity',
        sourceId: 'test-src',
        methodId: 'liquidity',
      });
      await completeFailure(db, { attemptId: started.attemptId, error: new Error('timeout') });
    }
    const after = (await db.select().from(schema.collectionAttempts)).length;
    expect(after - before).toBe(3);
  });

  it('T23: Start is persisted before the request body runs', async () => {
    const started = await startAttempt(db, {
      projectId: 'proj-neural',
      factKind: 'liquidity',
      sourceId: 'test-src',
      methodId: 'liquidity',
    });
    const rows = await db.select().from(schema.collectionAttempts).where(eq(schema.collectionAttempts.id, started.attemptId));
    expect(rows).toHaveLength(1);
    const outcomes = await db.select().from(schema.attemptOutcomes).where(eq(schema.attemptOutcomes.attemptId, started.attemptId));
    expect(outcomes).toHaveLength(0);
    await completeFailure(db, { attemptId: started.attemptId, error: new Error('timeout') });
  });

  it('R5-T02: a second outcome for the same attempt is rejected', async () => {
    const started = await startAttempt(db, {
      projectId: 'proj-neural',
      factKind: 'liquidity',
      sourceId: 'test-src',
      methodId: 'liquidity',
    });
    await completeFailure(db, { attemptId: started.attemptId, error: new Error('timeout') });
    await expect(completeFailure(db, { attemptId: started.attemptId, error: new Error('timeout') })).rejects.toThrow();
    const outcomes = await db.select().from(schema.attemptOutcomes).where(eq(schema.attemptOutcomes.attemptId, started.attemptId));
    expect(outcomes).toHaveLength(1);
  });

  it('T02: identical bytes converge on the same receipt_key', async () => {
    const payload = { tvlUsdTotal: 4242, exitDepthUsd: 1, pools: [] };
    const keys: string[] = [];
    for (let i = 0; i < 2; i++) {
      const started = await startAttempt(db, {
        projectId: 'proj-neural',
        factKind: 'liquidity',
        sourceId: 'test-src',
        methodId: 'liquidity',
        observationKey: 'same-obs-key',
      });
      const { receiptId } = await completeSuccess(db, {
        attemptId: started.attemptId,
        observationKey: started.observationKey,
        projectId: 'proj-neural',
        fact: { ...fact(), payload } as import('./contract').ChainFact,
        writeEvidence: false,
      });
      keys.push(receiptId);
    }
    expect(keys[0]).toBe(keys[1]);
    const receipts = (await db.select().from(schema.rawReceipts)).filter((r) => r.observationKey === 'same-obs-key');
    expect(receipts).toHaveLength(1);
    expect(receipts[0].payloadRef).toBeTruthy();
  });

  it('payload_ref has no FK: blob can be deleted while receipt row remains', async () => {
    const started = await startAttempt(db, {
      projectId: 'proj-neural',
      factKind: 'liquidity',
      sourceId: 'test-src',
      methodId: 'liquidity',
    });
    const { receiptId } = await completeSuccess(db, {
      attemptId: started.attemptId,
      observationKey: started.observationKey,
      projectId: 'proj-neural',
      fact: fact() as import('./contract').ChainFact,
      writeEvidence: false,
    });
    const [receipt] = await db.select().from(schema.rawReceipts).where(eq(schema.rawReceipts.id, receiptId));
    await db.delete(schema.rawBlobs).where(eq(schema.rawBlobs.blobKey, receipt.payloadRef));
    const still = await db.select().from(schema.rawReceipts).where(eq(schema.rawReceipts.id, receiptId));
    expect(still).toHaveLength(1);
    expect(still[0].payloadRef).toBe(receipt.payloadRef);
  });

  it('PARTIAL contract failure still writes exactly one outcome', async () => {
    const started = await startAttempt(db, {
      projectId: 'proj-neural',
      factKind: 'liquidity',
      sourceId: 'test-src',
      methodId: 'liquidity',
    });
    await completeFailure(db, { attemptId: started.attemptId, error: new ContractViolation('bad') });
    const [row] = await db.select().from(schema.attemptOutcomes).where(eq(schema.attemptOutcomes.attemptId, started.attemptId));
    expect(row.outcome).toBe('PARTIAL');
    expect(row.responseBytesReceived).toBe(1);
  });

  it('plan items exist for fixture projects', async () => {
    const id = await ensurePlanItem(db, {
      sourceId: 'fixture',
      methodId: 'liquidity',
      projectId: 'proj-neural',
      factKind: 'liquidity',
    });
    const rows = await db.select().from(schema.collectionPlanItems).where(eq(schema.collectionPlanItems.id, id));
    expect(rows).toHaveLength(1);
  });
});
