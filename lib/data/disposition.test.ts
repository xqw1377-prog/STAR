import { describe, beforeAll, it, expect } from 'vitest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { eq } from 'drizzle-orm';

process.env.PGLITE_DATA_DIR = mkdtempSync(join(tmpdir(), 'star-disp-'));

let db: import('@/lib/db').StarDb;
let schema: typeof import('@/db/schema');
let startAttempt: typeof import('./ledger').startAttempt;
let completeSuccess: typeof import('./ledger').completeSuccess;
let requestPurge: typeof import('./disposition').requestPurge;
let executePurge: typeof import('./disposition').executePurge;
let placeHold: typeof import('./disposition').placeHold;
let releaseHold: typeof import('./disposition').releaseHold;
let resolvePayload: typeof import('./resolve').resolvePayload;
let resolveFactPayload: typeof import('./resolve').resolveFactPayload;
let loadIneligibleFacts: typeof import('./eligibility').loadIneligibleFacts;

beforeAll(async () => {
  const { getDb } = await import('@/db/client');
  db = await getDb();
  const { seedDatabase } = await import('@/db/seed');
  await seedDatabase(db);
  schema = await import('@/db/schema');
  const ledger = await import('./ledger');
  startAttempt = ledger.startAttempt;
  completeSuccess = ledger.completeSuccess;
  const disp = await import('./disposition');
  requestPurge = disp.requestPurge;
  executePurge = disp.executePurge;
  placeHold = disp.placeHold;
  releaseHold = disp.releaseHold;
  ({ resolvePayload, resolveFactPayload } = await import('./resolve'));
  ({ loadIneligibleFacts } = await import('./eligibility'));
});

async function seededReceipt(tag: string) {
  const started = await startAttempt(db, {
    projectId: 'proj-neural',
    factKind: 'liquidity',
    sourceId: 'disp-src',
    methodId: 'liquidity',
    observationKey: `obs-disp-${tag}`,
  });
  const { receiptId } = await completeSuccess(db, {
    attemptId: started.attemptId,
    observationKey: started.observationKey,
    projectId: 'proj-neural',
    fact: {
      kind: 'liquidity',
      contractVersion: 'solana-readonly@3',
      observedAt: '2026-09-04T00:00:00Z',
      slot: 7,
      source: 'disp-src',
      sourceUrl: null,
      chainId: 'solana',
      mint: '11111111111111111111111111111111',
      payload: { tvlUsdTotal: 123456 + tag.length, exitDepthUsd: 80000, pools: [] },
    },
    writeEvidence: false,
  });
  return receiptId;
}

describe('D1-A/B disposition projections', () => {
  it('T01 / R5-T14: HOLD blocks PURGE; RELEASE then allows execute', async () => {
    const receiptId = await seededReceipt('hold');
    await requestPurge(db, {
      receiptId, actor: 'ops', reason: 'test', authorizationRef: 'a1',
      scope: 'RAW_ONLY', idempotencyKey: 'k-hold',
    });
    await placeHold(db, {
      receiptId, actor: 'legal', reason: 'hold', authorizationRef: 'h1', idempotencyKey: 'k-hold-h',
    });
    const blocked = await executePurge(db, {
      receiptId, actor: 'ops', reason: 'test', authorizationRef: 'a1',
      scope: 'RAW_ONLY', idempotencyKey: 'k-hold-x',
    });
    expect(blocked.cancelled).toBe(true);
    const bytes = await resolvePayload(db, receiptId);
    expect(bytes.status).toBe('BYTES');
    await releaseHold(db, {
      receiptId, actor: 'legal', reason: 'release', authorizationRef: 'h1', idempotencyKey: 'k-hold-r',
    });
    const done = await executePurge(db, {
      receiptId, actor: 'ops', reason: 'test', authorizationRef: 'a1',
      scope: 'RAW_ONLY', idempotencyKey: 'k-hold-x2',
    });
    expect(done.cancelled).toBe(false);
    const purged = await resolvePayload(db, receiptId);
    expect(purged.status).toBe('PURGED');
    if (purged.status === 'PURGED') expect(purged.replay).toBe('RAW_SOURCE_PURGED');
  });

  it('R5-T15b: RAW_ONLY keeps fact payload; LICENSE_ERASURE erases derived bytes', async () => {
    const rawId = await seededReceipt('raw');
    const licId = await seededReceipt('lic');
    await executePurge(db, {
      receiptId: rawId, actor: 'ops', reason: 'raw', authorizationRef: 'a',
      scope: 'RAW_ONLY', idempotencyKey: 'raw-1',
    });
    await executePurge(db, {
      receiptId: licId, actor: 'ops', reason: 'lic', authorizationRef: 'a',
      scope: 'LICENSE_ERASURE', idempotencyKey: 'lic-1',
    });
    const raw = await resolvePayload(db, rawId);
    const lic = await resolvePayload(db, licId);
    expect(raw.status).toBe('PURGED');
    if (raw.status === 'PURGED') expect(raw.replay).toBe('RAW_SOURCE_PURGED');
    expect(lic.status).toBe('PURGED');
    if (lic.status === 'PURGED') expect(lic.replay).toBe('REPLAY_SOURCE_PURGED');

    const rawFacts = await db.select().from(schema.normalizedFacts).where(eq(schema.normalizedFacts.receiptId, rawId));
    const licFacts = await db.select().from(schema.normalizedFacts).where(eq(schema.normalizedFacts.receiptId, licId));
    const rawFact = await resolveFactPayload(db, rawFacts[0].id);
    const licFact = await resolveFactPayload(db, licFacts[0].id);
    expect(rawFact.status).toBe('PAYLOAD');
    expect(licFact.status).toBe('ERASED');
    const ineligible = await loadIneligibleFacts(db);
    expect(ineligible.some((f) => f.factId === licFacts[0].id && (f.reason === 'ERASED' || f.reason === 'REPLAY_SOURCE_PURGED'))).toBe(true);
    expect(ineligible.some((f) => f.factId === rawFacts[0].id && f.reason === 'ERASED')).toBe(false);
  });

  it('R5-T05: PURGE deletes blob bytes; receipt row and hash remain; no tombstone body', async () => {
    const receiptId = await seededReceipt('tomb');
    const [before] = await db.select().from(schema.rawReceipts).where(eq(schema.rawReceipts.id, receiptId));
    await executePurge(db, {
      receiptId, actor: 'ops', reason: 'x', authorizationRef: 'a',
      scope: 'RAW_ONLY', idempotencyKey: 'tomb-1',
    });
    const [after] = await db.select().from(schema.rawReceipts).where(eq(schema.rawReceipts.id, receiptId));
    expect(after.payloadHash).toBe(before.payloadHash);
    expect(after.payloadRef).toBe(before.payloadRef);
    const blobs = await db.select().from(schema.rawBlobs).where(eq(schema.rawBlobs.blobKey, after.payloadRef));
    expect(blobs).toHaveLength(0);
    const ghost = blobs.find((b) => b.body.includes('TOMBSTONE') || b.body.includes(after.payloadHash));
    expect(ghost).toBeUndefined();
  });
});
