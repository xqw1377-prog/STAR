import { describe, beforeAll, it, expect } from 'vitest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { readFileSync } from 'fs';
import { eq } from 'drizzle-orm';

process.env.PGLITE_DATA_DIR = mkdtempSync(join(tmpdir(), 'star-recorder-'));

let db: import('@/lib/db').StarDb;
let schema: typeof import('@/db/schema');
let recordNewPoolBirth: typeof import('./record').recordNewPoolBirth;
let recordFixtureUniverse: typeof import('./discover').recordFixtureUniverse;
let recordFixtureBooks: typeof import('./discover').recordFixtureBooks;
let fixtureCoverage: typeof import('./discover').fixtureCoverage;
let latencyFromLedger: typeof import('./latency').latencyFromLedger;
let COLLECTOR_VERSION: typeof import('./version').COLLECTOR_VERSION;
let FIXTURE_NEW_POOLS: typeof import('./fixture-universe').FIXTURE_NEW_POOLS;

beforeAll(async () => {
  const { getDb } = await import('@/db/client');
  db = await getDb();
  const { seedDatabase } = await import('@/db/seed');
  await seedDatabase(db);
  schema = await import('@/db/schema');
  ({ recordNewPoolBirth } = await import('./record'));
  ({ recordFixtureUniverse, recordFixtureBooks, fixtureCoverage } = await import('./discover'));
  ({ latencyFromLedger } = await import('./latency'));
  ({ COLLECTOR_VERSION } = await import('./version'));
  ({ FIXTURE_NEW_POOLS } = await import('./fixture-universe'));
});

describe('M1 Market Recorder', () => {
  it('records fixture births append-only with collector_version', async () => {
    const before = (await db.select().from(schema.collectionAttempts)).length;
    const results = await recordFixtureUniverse(db);
    expect(results).toHaveLength(FIXTURE_NEW_POOLS.length);
    expect(results.every((r) => r.ok && r.collectorVersion === COLLECTOR_VERSION)).toBe(true);
    const after = (await db.select().from(schema.collectionAttempts)).length;
    expect(after - before).toBe(FIXTURE_NEW_POOLS.length);
    const again = await recordFixtureUniverse(db);
    expect(again).toHaveLength(FIXTURE_NEW_POOLS.length);
    const twice = (await db.select().from(schema.collectionAttempts)).length;
    expect(twice - before).toBe(FIXTURE_NEW_POOLS.length * 2);
  });

  it('never drops a failed observation', async () => {
    const beforeAttempts = (await db.select().from(schema.collectionAttempts)).length;
    const beforeOutcomes = (await db.select().from(schema.attemptOutcomes)).length;
    const bad = {
      ...FIXTURE_NEW_POOLS[0],
      mint: 'FailMint11111111111111111111111111111111',
      initialReserveSolEq: -1,
    };
    const result = await recordNewPoolBirth(db, bad);
    expect(result.ok).toBe(false);
    expect(result.outcome).not.toBe('SUCCESS');
    const afterAttempts = (await db.select().from(schema.collectionAttempts)).length;
    const afterOutcomes = (await db.select().from(schema.attemptOutcomes)).length;
    expect(afterAttempts - beforeAttempts).toBe(1);
    expect(afterOutcomes - beforeOutcomes).toBe(1);
    const [attempt] = await db.select().from(schema.collectionAttempts)
      .where(eq(schema.collectionAttempts.id, result.attemptId));
    expect(attempt.requestParamsSanitized).toContain('star-recorder@1');
  });

  it('does not import decision engine or domain gates', () => {
    const src = [
      readFileSync(new URL('./record.ts', import.meta.url), 'utf8'),
      readFileSync(new URL('./discover.ts', import.meta.url), 'utf8'),
      readFileSync(new URL('./coverage.ts', import.meta.url), 'utf8'),
      readFileSync(new URL('./latency.ts', import.meta.url), 'utf8'),
      readFileSync(new URL('./index.ts', import.meta.url), 'utf8'),
    ].join('\n');
    expect(src).not.toMatch(/from '@\/lib\/engine'/);
    expect(src).not.toMatch(/from '@\/lib\/domain/);
    expect(src).not.toMatch(/from '@\/lib\/oracle/);
  });

  it('records point-in-time pool books', async () => {
    const results = await recordFixtureBooks(db);
    expect(results.every((r) => r.ok)).toBe(true);
    const facts = await db.select().from(schema.normalizedFacts);
    expect(facts.some((f) => f.factKind === 'pool-book')).toBe(true);
  });

  it('computes U-04 coverage and refuses to call it evidence', () => {
    const report = fixtureCoverage(FIXTURE_NEW_POOLS.map((p) => p.mint));
    expect(report.missed).toEqual(['MissedMint1111111111111111111111111111111']);
    expect(report.coverage).toBe(0.75);
    expect(report.evidenceReady).toBe(false);
    expect(fixtureCoverage([]).independentMints.length).toBeGreaterThan(0);
    expect(fixtureCoverage([]).coverage).toBe(0);
  });

  it('keeps observed_at on backfill and excludes it from live latency', async () => {
    const birth = {
      ...FIXTURE_NEW_POOLS[0],
      mint: 'BackfillMint111111111111111111111111111',
    };
    const result = await recordNewPoolBirth(db, birth, { timingQuality: 'BACKFILLED_UNKNOWN' });
    expect(result.ok).toBe(true);
    const [attempt] = await db.select().from(schema.collectionAttempts)
      .where(eq(schema.collectionAttempts.id, result.attemptId));
    expect(attempt.timingQuality).toBe('BACKFILLED_UNKNOWN');
    const latency = await latencyFromLedger(db);
    expect(latency.liveOnly).toBe(true);
    expect(latency.n).toBeGreaterThan(0);
  });

  it('fail-closes real program-log source and still writes the attempt', async () => {
    const birth = {
      ...FIXTURE_NEW_POOLS[0],
      mint: 'RpcMint111111111111111111111111111111111',
      source: 'solana-program-log' as const,
    };
    const before = (await db.select().from(schema.collectionAttempts)).length;
    const result = await recordNewPoolBirth(db, birth);
    expect(result.ok).toBe(false);
    const after = (await db.select().from(schema.collectionAttempts)).length;
    expect(after - before).toBe(1);
  });
});
