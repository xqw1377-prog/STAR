import { describe, beforeAll, it, expect } from 'vitest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { eq } from 'drizzle-orm';

process.env.PGLITE_DATA_DIR = mkdtempSync(join(tmpdir(), 'star-lineage-'));

let db: import('@/lib/db').StarDb;
let schema: typeof import('@/db/schema');
let loadEvidenceLineage: typeof import('./lineage').loadEvidenceLineage;
let runReplay: typeof import('@/lib/queries').runReplay;
let startAttempt: typeof import('./ledger').startAttempt;
let completeSuccess: typeof import('./ledger').completeSuccess;

beforeAll(async () => {
  const { getDb } = await import('@/db/client');
  db = await getDb();
  await (await import('@/db/seed')).seedDatabase(db);
  schema = await import('@/db/schema');
  ({ loadEvidenceLineage } = await import('./lineage'));
  ({ runReplay } = await import('@/lib/queries'));
  const ledger = await import('./ledger');
  startAttempt = ledger.startAttempt;
  completeSuccess = ledger.completeSuccess;
});

describe('Replay Lab wiring (T03b / T16 surface)', () => {
  it('T03b: fixture evidence that was backfilled links hash to receipt and fact', async () => {
    const rows = await loadEvidenceLineage(db, 'proj-neural');
    const linked = rows.filter((r) => r.status === 'LINKED');
    expect(linked.length).toBeGreaterThan(0);
    expect(linked.every((r) => r.receiptId && r.factId && r.payloadHash)).toBe(true);
  });

  it('T16: HISTORICAL freeze survives project cache mutation; REINTERPRET is marked', async () => {
    const asOf = new Date('2026-08-25T12:00:00Z');
    const historical = await runReplay(db, { projectId: 'proj-neural', asOf, mode: 'HISTORICAL' });
    expect(historical.mode).toBe('HISTORICAL');
    expect(historical.contextId).toBeTruthy();
    expect(historical.evaluation.gates.some((g) => g.gate === 'token-permissions')).toBe(true);
    await db.update(schema.projects).set({ lifecycle: 'DEAD' }).where(eq(schema.projects.id, 'proj-neural'));
    const again = await runReplay(db, { projectId: 'proj-neural', asOf, mode: 'HISTORICAL' });
    expect(JSON.stringify(again.evaluation.gates)).toBe(JSON.stringify(historical.evaluation.gates));
    expect(again.evaluation.readiness).toBe(historical.evaluation.readiness);
    const live = await runReplay(db, { projectId: 'proj-neural', asOf, mode: 'REINTERPRET' });
    expect(live.mode).toBe('REINTERPRET');
    expect(live.contextId).toBeTruthy();
  });

  it('T03b write path: new collect evidence.hash equals receipt.payload_hash', async () => {
    const started = await startAttempt(db, {
      projectId: 'proj-neural', factKind: 'liquidity', sourceId: 'close', methodId: 'liquidity',
      observationKey: 'obs-ui-lineage',
    });
    const { receiptId } = await completeSuccess(db, {
      attemptId: started.attemptId,
      observationKey: started.observationKey,
      projectId: 'proj-neural',
      fact: {
        kind: 'liquidity',
        contractVersion: 'solana-readonly@3',
        observedAt: '2026-09-04T00:00:00Z',
        slot: 99,
        source: 'close',
        sourceUrl: null,
        chainId: 'solana',
        mint: '11111111111111111111111111111111',
        payload: { tvlUsdTotal: 888000, exitDepthUsd: 80000, pools: [] },
      },
      writeEvidence: true,
    });
    const [receipt] = await db.select().from(schema.rawReceipts).where(eq(schema.rawReceipts.id, receiptId));
    const rows = await loadEvidenceLineage(db, 'proj-neural');
    expect(rows.some((r) => r.receiptId === receiptId && r.evidenceHash === receipt.payloadHash && r.status === 'LINKED')).toBe(true);
  });
});
