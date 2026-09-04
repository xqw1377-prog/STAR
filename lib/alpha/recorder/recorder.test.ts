/* eslint-disable @typescript-eslint/no-explicit-any -- raw-handle probes typed loosely */
/**
 * M1 Recorder tests: facts land on the D1 ledger with full lineage, and the
 * fact-only constraints hold (no signal/optimization/wallet imports).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { readFile } from 'fs/promises';

process.env.PGLITE_DATA_DIR = mkdtempSync(join(tmpdir(), 'star-m1-'));

let db: any;
let probe: { query: (q: string, p?: unknown[]) => Promise<any> };
const T0 = '2026-09-05T00:00:00Z';

beforeAll(async () => {
  const { getDb } = await import('@/db/client');
  const schema = await import('@/db/schema');
  db = await getDb();
  const { getPglite } = await import('@/db/client');
  probe = (await getPglite()) as any;
  void readFile;
  // Minimal research-side rows so evidence projection FKs resolve.
  const c = await db.select().from(schema.chains).limit(1);
  if (!c.length) await db.insert(schema.chains).values({ id: 'solana', name: 'Solana' });
  const n = await db.select().from(schema.narratives).limit(1);
  if (!n.length) await db.insert(schema.narratives).values({
    id: 'nar-m1', name: 'M1 Fixture Narrative', discoveredAt: new Date('2026-09-01'), updatedAt: new Date('2026-09-01'),
  });
  const p = await db.select().from(schema.projects).limit(1);
  if (!p.length) await db.insert(schema.projects).values({
    id: 'proj-m1', name: 'M1 Fixture Project', symbol: 'M1F', chainId: 'solana', narrativeId: 'nar-m1',
    discoveredAt: new Date('2026-09-01'),
  });
});

describe('M1 recorder (fact-only)', () => {
  it('records a pool birth with full lineage and U-01 denominator gate', async () => {
    const { recordNewPoolBirth } = await import('./record');
    const res = await recordNewPoolBirth(db, {
      mint: 'MintA1111111111111111111111111111111111',
      dex: 'pump.fun-bonding-curve',
      quoteAsset: 'SOL',
      poolAddress: 'PoolA111111111111111111111111111111111',
      initialReserveSolEq: 12.5, // ≥ 8 ⇒ denominator
      observedAt: T0, effectiveAt: T0, slot: 300_000_001, source: 'fixture',
    });
    expect(res.receiptId).toBeTruthy();
    expect(res.enteredDenominator).toBe(true);
    const facts: any = await probe.query(
      "SELECT fact_kind FROM normalized_fact WHERE receipt_id = $1", [res.receiptId]);
    expect(facts.rows.map((r: any) => r.fact_kind)).toContain('pool-birth');
    const links: any = await probe.query(
      'SELECT count(*)::int AS n FROM attempt_receipt_link WHERE receipt_id = $1', [res.receiptId]);
    expect(links.rows[0].n).toBeGreaterThanOrEqual(1);
  });

  it('sub-8-SOL birth stays out of the discovery denominator', async () => {
    const { recordNewPoolBirth } = await import('./record');
    const res = await recordNewPoolBirth(db, {
      mint: 'MintB2222222222222222222222222222222222',
      dex: 'raydium-amm-v4', quoteAsset: 'USDC',
      poolAddress: 'PoolB222222222222222222222222222222222',
      initialReserveSolEq: 3.1, observedAt: T0, effectiveAt: T0, slot: 300_000_002, source: 'fixture',
    });
    expect(res.enteredDenominator).toBe(false);
  });

  it('records a pool book snapshot and a priority-fee window', async () => {
    const { recordPoolBook, recordPriorityFeeWindow } = await import('./record');
    const book = await recordPoolBook(db, {
      mint: 'MintA1111111111111111111111111111111111',
      poolAddress: 'PoolA111111111111111111111111111111111',
      quoteReserveSol: 42.0, baseReserveRaw: '1000000000',
      slot: 300_000_010, observedAt: T0, source: 'fixture',
    });
    expect(book.receiptId).toBeTruthy();
    const fee = await recordPriorityFeeWindow(db, [
      { slot: 300_000_011, feeLamports: 1200, feeMetric: 'per-cu', observedAt: T0, source: 'fixture' },
      { slot: 300_000_012, feeLamports: 1800, feeMetric: 'per-cu', observedAt: T0, source: 'fixture' },
    ]);
    expect(fee.sampleCount).toBe(2);
  });

  it('never drops a failed observation', async () => {
    const { recordNewPoolBirth } = await import('./record');
    const before: any = await probe.query('SELECT count(*)::int AS n FROM collection_attempt');
    const beforeOut: any = await probe.query('SELECT count(*)::int AS n FROM attempt_outcome_event');
    const res = await recordNewPoolBirth(db, {
      mint: 'FailMint11111111111111111111111111111111',
      dex: 'pump.fun-bonding-curve',
      quoteAsset: 'SOL',
      poolAddress: 'FailPool1111111111111111111111111111111',
      initialReserveSolEq: -1,
      observedAt: T0, effectiveAt: T0, slot: 300_000_020, source: 'fixture',
    });
    expect(res.ok).toBe(false);
    expect(res.outcome).not.toBe('SUCCESS');
    expect(res.enteredDenominator).toBe(false);
    const after: any = await probe.query('SELECT count(*)::int AS n FROM collection_attempt');
    const afterOut: any = await probe.query('SELECT count(*)::int AS n FROM attempt_outcome_event');
    expect(after.rows[0].n - before.rows[0].n).toBe(1);
    expect(afterOut.rows[0].n - beforeOut.rows[0].n).toBe(1);
  });

  it('fail-closes a non-ENABLED source onto the ledger', async () => {
    const { recordNewPoolBirth } = await import('./record');
    const res = await recordNewPoolBirth(db, {
      mint: 'LiveMint11111111111111111111111111111111',
      dex: 'pump.fun-bonding-curve',
      quoteAsset: 'SOL',
      poolAddress: 'LivePool1111111111111111111111111111111',
      initialReserveSolEq: 20,
      observedAt: T0, effectiveAt: T0, slot: 300_000_021, source: 'solana-program-log',
    });
    expect(res.ok).toBe(false);
    expect(res.outcome).toBe('SOURCE_ERROR');
    const row: any = await probe.query(
      'SELECT outcome, error_code FROM attempt_outcome_event WHERE attempt_id = $1',
      [res.attemptId],
    );
    expect(row.rows[0].outcome).toBe('SOURCE_ERROR');
    expect(row.rows[0].error_code).toBe('SOURCE_NOT_ENABLED');
    const facts: any = await probe.query(
      'SELECT count(*)::int AS n FROM normalized_fact nf JOIN attempt_receipt_link l ON l.receipt_id = nf.receipt_id WHERE l.outcome_event_id IN (SELECT id FROM attempt_outcome_event WHERE attempt_id = $1)',
      [res.attemptId],
    );
    expect(facts.rows[0].n).toBe(0);
  });

  it('records the fixture universe and measures U-04 coverage', async () => {
    const { recordFixtureUniverse } = await import('./discover');
    const { coverageAgainstSecondReplay } = await import('./coverage');
    const { FIXTURE_NEW_POOLS } = await import('./fixture-universe');
    const results = await recordFixtureUniverse(db);
    expect(results).toHaveLength(FIXTURE_NEW_POOLS.length);
    expect(results.every((r) => r.ok)).toBe(true);
    const mints = FIXTURE_NEW_POOLS.map((p) => p.mint);
    expect(coverageAgainstSecondReplay(mints, []).measurable).toBe(false);
    const full = coverageAgainstSecondReplay(mints, mints);
    expect(full.measurable).toBe(true);
    expect(full.coverage).toBe(1);
    const partial = coverageAgainstSecondReplay(mints.slice(0, 2), mints);
    expect(partial.coverage).toBeCloseTo(2 / 3);
    expect(partial.missing).toEqual([mints[2]]);
  });

  it('CONSTRAINT: recorder imports no signals/optimization/wallet modules', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const dir = path.join(process.cwd(), 'lib/alpha/recorder');
    const banned = /wallet|sign|broadcast|strategy|signal|optimiz|sendTransaction|Keypair/i;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.ts')) continue;
      const text = fs.readFileSync(path.join(dir, f), 'utf8');
      const hits = [...text.matchAll(/import[^;]+from\s+'([^']+)'/g)]
        .map((m) => m[1]).filter((imp) => banned.test(imp));
      expect(hits, `${f} banned imports: ${hits}`).toEqual([]);
    }
  });
});
