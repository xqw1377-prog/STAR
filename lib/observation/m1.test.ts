/**
 * M1 hard acceptance — the ten frozen criteria, on an isolated PGlite store.
 * 1 fixture ingestion · 2 replay · 3 same pipeline · 4 idempotency
 * 5 atomic checkpoint · 6 gap detection · 7 gap recovery · 8 dead letter
 * 9 verification · 10 zero-write gate/decision audit (malicious input included)
 */
import { describe, expect, it, beforeAll } from 'vitest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { readFile } from 'fs/promises';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import { ensureCoreAndD1 } from '@/db/apply-sql';
import type { StarDb } from '@/lib/db';
import { runPipelineBatch } from './pipeline';
import { verifyObservationStore } from './verify';
import { M1_FIXTURE_SOURCE, fixtureBirths, fixtureStream, maliciousStream } from './fixture-source';

let pglite: import('@electric-sql/pglite').PGlite;
let db: StarDb;

async function count(table: string): Promise<number> {
  const res = (await pglite.query(`SELECT count(*)::int AS n FROM ${table}`)) as { rows: { n: number }[] };
  return Number(res.rows[0].n);
}

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'star-m1-'));
  const { PGlite } = await import('@electric-sql/pglite');
  pglite = new PGlite(dir);
  await pglite.waitReady;
  const readSql = (name: string) => readFile(join(process.cwd(), 'public', name), 'utf8');
  await ensureCoreAndD1(pglite, readSql);
  db = drizzle(pglite, { schema }) as unknown as StarDb;
});

describe('M1-1/2/3 fixture ingestion, replay, same pipeline', () => {
  it('ingests the fixture stream through the live pipeline', async () => {
    const result = await runPipelineBatch(db, { sourceId: M1_FIXTURE_SOURCE, mode: 'live', envelopes: fixtureStream() });
    expect(result.committed).toBe(8);
    expect(result.deadLettered).toBe(0);
    expect(result.checkpoint).toBe(1181);
    expect(await count('m1_observation')).toBe(8);
    expect(await count('m1_batch')).toBe(1);
  });

  it('replays the same envelopes through the SAME pipeline: zero duplicates, identical outputs', async () => {
    const liveRows = (await pglite.query(
      `SELECT observation_key, normalized FROM m1_observation ORDER BY observation_key`,
    )) as { rows: Array<{ observation_key: string; normalized: unknown }> };

    const replay = await runPipelineBatch(db, { sourceId: M1_FIXTURE_SOURCE, mode: 'replay', envelopes: fixtureStream() });
    expect(replay.committed).toBe(0);
    expect(replay.duplicated).toBe(8);
    expect(await count('m1_observation')).toBe(8);

    const replayRows = (await pglite.query(
      `SELECT observation_key, normalized FROM m1_observation ORDER BY observation_key`,
    )) as { rows: Array<{ observation_key: string; normalized: unknown }> };
    expect(replayRows.rows).toEqual(liveRows.rows);
  });

  it('replay on a FRESH store produces the identical normalized set as live did', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'star-m1-replay-'));
    const { PGlite } = await import('@electric-sql/pglite');
    const fresh = new PGlite(dir);
    await fresh.waitReady;
    const readSql = (name: string) => readFile(join(process.cwd(), 'public', name), 'utf8');
    await ensureCoreAndD1(fresh, readSql);
    const freshDb = drizzle(fresh, { schema }) as unknown as StarDb;
    await runPipelineBatch(freshDb, { sourceId: M1_FIXTURE_SOURCE, mode: 'replay', envelopes: fixtureStream() });
    const freshRows = (await fresh.query(
      `SELECT observation_key, normalized FROM m1_observation ORDER BY observation_key`,
    )) as { rows: Array<{ observation_key: string; normalized: unknown }> };
    const liveRows = (await pglite.query(
      `SELECT observation_key, normalized FROM m1_observation ORDER BY observation_key`,
    )) as { rows: Array<{ observation_key: string; normalized: unknown }> };
    expect(freshRows.rows).toEqual(liveRows.rows);
  });
});

describe('M1-4/5 idempotency and atomic checkpoint', () => {
  it('re-ingesting births adds nothing (ON CONFLICT semantics)', async () => {
    const before = await count('m1_observation');
    const again = await runPipelineBatch(db, { sourceId: M1_FIXTURE_SOURCE, mode: 'live', envelopes: fixtureBirths() });
    expect(again.committed).toBe(0);
    expect(await count('m1_observation')).toBe(before);
  });

  it('a decode-failure-only batch commits nothing and does NOT advance the watermark (slot claim unvalidated)', async () => {
    const cpBefore = (await pglite.query(`SELECT highest_fully_processed_slot AS s FROM m1_checkpoint WHERE id = 1`) as { rows: Array<{ s: number }> }).rows[0]?.s;
    const poison = await runPipelineBatch(db, {
      sourceId: M1_FIXTURE_SOURCE,
      mode: 'live',
      envelopes: [{ sourceId: M1_FIXTURE_SOURCE, slot: -5, signature: null, instructionIndex: null, observedAt: null, kind: 'asset-birth', raw: { mint: 'x' } }],
    });
    expect(poison.committed).toBe(0);
    expect(poison.deadLettered).toBe(1);
    expect(poison.checkpoint).toBe(cpBefore);
    const cpAfter = (await pglite.query(`SELECT highest_fully_processed_slot AS s FROM m1_checkpoint WHERE id = 1`) as { rows: Array<{ s: number }> }).rows[0]?.s;
    expect(cpAfter).toBe(cpBefore);
  });

  it('a mixed batch commits the good rows atomically and dead-letters the poison', async () => {
    const before = await count('m1_observation');
    const mixed = await runPipelineBatch(db, {
      sourceId: M1_FIXTURE_SOURCE,
      mode: 'live',
      envelopes: [
        // good observation at a later slot
        ...fixtureBirths().slice(0, 1).map((e) => ({ ...e, slot: e.slot + 5000, signature: (e.signature ?? 'x') + 'r' })),
        // interpret-stage poison BELOW the good slot: terminally dispositioned,
        // watermark still advances via the good row
        { sourceId: M1_FIXTURE_SOURCE, slot: 5999, signature: null, instructionIndex: null, observedAt: null, kind: 'risk-level', raw: { level: 'HIGH' } },
      ],
    });
    expect(mixed.committed).toBe(1);
    expect(mixed.deadLettered).toBe(1);
    expect(await count('m1_observation')).toBe(before + 1);
    expect(mixed.checkpoint).toBe(6001);
  });
});

describe('M1-6/7 gap detection and recovery', () => {
  it('records explicit gaps when the stream jumps past checkpoint+1', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'star-m1-gap-'));
    const { PGlite } = await import('@electric-sql/pglite');
    const gapDb = new PGlite(dir);
    await gapDb.waitReady;
    const readSql = (name: string) => readFile(join(process.cwd(), 'public', name), 'utf8');
    await ensureCoreAndD1(gapDb, readSql);
    const gdb = drizzle(gapDb, { schema }) as unknown as StarDb;

    // Births at 1001/1061/1121 only — the jumps are explicit gaps.
    const first = await runPipelineBatch(gdb, { sourceId: M1_FIXTURE_SOURCE, mode: 'live', envelopes: fixtureBirths().slice(0, 1) });
    expect(first.gapsOpened).toEqual([]);
    const second = await runPipelineBatch(gdb, { sourceId: M1_FIXTURE_SOURCE, mode: 'live', envelopes: fixtureBirths().slice(1, 2) });
    expect(second.gapsOpened).toEqual([{ fromSlot: 1002, toSlot: 1060 }]);
    const gaps = (await gapDb.query(`SELECT from_slot, to_slot, status FROM m1_gap`) as { rows: Array<{ from_slot: number; to_slot: number; status: string }> }).rows;
    expect(gaps).toEqual([{ from_slot: 1002, to_slot: 1060, status: 'OPEN' }]);
  });

  it('recovers: a delayed envelope landing inside an OPEN gap backfills it', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'star-m1-rec-'));
    const { PGlite } = await import('@electric-sql/pglite');
    const recDb = new PGlite(dir);
    await recDb.waitReady;
    const readSql = (name: string) => readFile(join(process.cwd(), 'public', name), 'utf8');
    await ensureCoreAndD1(recDb, readSql);
    const rdb = drizzle(recDb, { schema }) as unknown as StarDb;

    const births = fixtureBirths();
    // Baseline at 1001, then a jump straight to 1121 → one explicit gap 1002–1120.
    await runPipelineBatch(rdb, { sourceId: M1_FIXTURE_SOURCE, mode: 'live', envelopes: [births[0]] });
    const jump = await runPipelineBatch(rdb, { sourceId: M1_FIXTURE_SOURCE, mode: 'live', envelopes: [births[2]] });
    expect(jump.gapsOpened).toEqual([{ fromSlot: 1002, toSlot: 1120 }]);
    const openBefore = (await recDb.query(`SELECT count(*)::int AS n FROM m1_gap WHERE status='OPEN'`) as { rows: Array<{ n: number }> }).rows[0].n;
    expect(openBefore).toBe(1);

    const recovery = await runPipelineBatch(rdb, { sourceId: M1_FIXTURE_SOURCE, mode: 'replay', envelopes: [births[1]] });
    expect(recovery.committed).toBe(1);
    expect(recovery.gapsBackfilled).toBe(1);
    const openAfter = (await recDb.query(`SELECT count(*)::int AS n FROM m1_gap WHERE status='OPEN'`) as { rows: Array<{ n: number }> }).rows[0].n;
    const backfilled = (await recDb.query(`SELECT count(*)::int AS n FROM m1_gap WHERE status='BACKFILLED' AND backfill_batch_id IS NOT NULL`) as { rows: Array<{ n: number }> }).rows[0].n;
    expect(openAfter).toBe(0);
    expect(backfilled).toBe(1);
  });
});

describe('M1-8/9 dead letter and verification', () => {
  it('dead letters preserve full original context', async () => {
    await runPipelineBatch(db, { sourceId: M1_FIXTURE_SOURCE, mode: 'live', envelopes: maliciousStream() });
    const rows = (await pglite.query(
      `SELECT source_id, slot, signature, stage, error, raw_payload, first_seen_at, retry_count FROM m1_dead_letter ORDER BY slot`,
    )) as { rows: Array<Record<string, unknown>> };
    expect(rows.rows.length).toBeGreaterThanOrEqual(4);
    for (const row of rows.rows) {
      expect(row.source_id).toBeTruthy();
      expect(row.stage).toBeTruthy();
      expect(row.error).toBeTruthy();
      expect(row.raw_payload).toBeTruthy();
      expect(row.first_seen_at).toBeTruthy();
      expect(row.retry_count).toBe(0);
    }
    const stages = rows.rows.map((r) => r.stage);
    expect(stages).toContain('interpret'); // verdict kinds rejected
    expect(stages).toContain('normalize'); // missing raw fields rejected
    expect(stages).toContain('decode'); // structural garbage rejected
  });

  it('verification recomputes consistency and passes on the healthy store', async () => {
    const report = await verifyObservationStore(db, M1_FIXTURE_SOURCE);
    expect(report.problems).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.checkpoint).toBe(6001);
  });

  it('append-only is enforced by the database on observation/batch/dead-letter', async () => {
    await expect(pglite.query(`UPDATE m1_observation SET kind = 'tampered'`)).rejects.toThrow(/star-immutable/);
    await expect(pglite.query(`DELETE FROM m1_batch`)).rejects.toThrow(/star-immutable/);
    await expect(pglite.query(`UPDATE m1_dead_letter SET error = 'gone'`)).rejects.toThrow(/star-immutable/);
  });
});

describe('M1-10 zero-write gate/decision audit (malicious input included)', () => {
  it('no gate/score/decision/position/evidence/b1 write ever occurs', async () => {
    for (const table of [
      'gates', 'scores', 'decisions', 'shadow_positions', 'evidence',
      'b1_event', 'b1_narrative', 'b1_event_narrative_link', 'b1_narrative_asset', 'b1_anchor',
    ]) {
      expect(await count(table)).toBe(0);
    }
  });
});
