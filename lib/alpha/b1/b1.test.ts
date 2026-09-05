/**
 * B1 hard acceptance (B1-7 / B1-8) on an isolated PGlite instance:
 *  - the full fixture recording chain lands exactly the expected rows;
 *  - re-running is idempotent (append-only + natural-key dedup);
 *  - the write surface touches ONLY the five b1_* tables — evidence, gates,
 *    scores, decisions, shadow_positions and the D1 ledger stay untouched;
 *  - the database itself rejects UPDATE/DELETE on b1 tables (append-only);
 *  - relation direction + referential discipline + contract validation hold.
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
import { runB1FixtureIngest } from './ingest';
import { recordEventNarrativeLink, recordNarrativeAsset, recordAnchor } from './record';
import { B1_RECORDER_VERSION } from './contract';

let pglite: import('@electric-sql/pglite').PGlite;
let db: StarDb;

async function count(table: string): Promise<number> {
  const res = (await pglite.query(`SELECT count(*)::int AS n FROM ${table}`)) as { rows: { n: number }[] };
  return Number(res.rows[0].n);
}

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'star-b1-'));
  const { PGlite } = await import('@electric-sql/pglite');
  pglite = new PGlite(dir);
  await pglite.waitReady;
  const readSql = (name: string) => readFile(join(process.cwd(), 'public', name), 'utf8');
  await ensureCoreAndD1(pglite, readSql);
  db = drizzle(pglite, { schema }) as unknown as StarDb;
});

describe('B1-7 full fixture recording chain', () => {
  it('records 2 events, 2 narratives, 2 links, 3 assets (one cluster of 2), 6 anchors', async () => {
    const summary = await runB1FixtureIngest(db);
    expect(summary.version).toBe(B1_RECORDER_VERSION);
    expect(summary.events).toEqual({ recorded: 2, created: 2 });
    expect(summary.narratives).toEqual({ recorded: 2, created: 2 });
    expect(summary.links).toEqual({ recorded: 2, created: 2 });
    expect(summary.assets).toEqual({ recorded: 3, created: 3 });
    expect(summary.anchors).toEqual({ recorded: 6, created: 6 });

    expect(await count('b1_event')).toBe(2);
    expect(await count('b1_narrative')).toBe(2);
    expect(await count('b1_event_narrative_link')).toBe(2);
    expect(await count('b1_narrative_asset')).toBe(3);
    expect(await count('b1_anchor')).toBe(6);

    // cluster semantics: the ai-agents narrative carries 2 assets
    const cluster = (await pglite.query(
      "SELECT count(*)::int AS n FROM b1_narrative_asset WHERE narrative_key = 'nar-fixture-ai-agents'",
    )) as { rows: { n: number }[] };
    expect(Number(cluster.rows[0].n)).toBe(2);

    // §14 anchors: T_event labeled, on-chain anchors observed
    const anchors = (await pglite.query(
      "SELECT anchor, basis FROM b1_anchor WHERE narrative_key = 'nar-fixture-ai-agents' ORDER BY anchor",
    )) as { rows: { anchor: string; basis: string }[] };
    expect(anchors.rows).toEqual([
      { anchor: 'T_event', basis: 'labeled' },
      { anchor: 'T_first_pool', basis: 'observed' },
      { anchor: 'T_first_token', basis: 'observed' },
    ]);
  });

  it('B1-8 write surface is b1_* ONLY — no evidence/gate/score/decision/exit/D1 side effects', async () => {
    for (const table of [
      'evidence', 'gates', 'scores', 'decisions', 'shadow_positions',
      'collection_attempt', 'raw_receipt', 'normalized_fact',
    ]) {
      expect(await count(table)).toBe(0);
    }
  });

  it('re-ingest is idempotent: nothing new, nothing changed', async () => {
    const before = {
      events: await count('b1_event'),
      narratives: await count('b1_narrative'),
      links: await count('b1_event_narrative_link'),
      assets: await count('b1_narrative_asset'),
      anchors: await count('b1_anchor'),
    };
    const summary = await runB1FixtureIngest(db);
    expect(summary.events.created).toBe(0);
    expect(summary.narratives.created).toBe(0);
    expect(summary.links.created).toBe(0);
    expect(summary.assets.created).toBe(0);
    expect(summary.anchors.created).toBe(0);
    expect(await count('b1_event')).toBe(before.events);
    expect(await count('b1_narrative')).toBe(before.narratives);
    expect(await count('b1_event_narrative_link')).toBe(before.links);
    expect(await count('b1_narrative_asset')).toBe(before.assets);
    expect(await count('b1_anchor')).toBe(before.anchors);
  });

  it('append-only is enforced by the database, not just by convention', async () => {
    await expect(pglite.query("UPDATE b1_event SET label = 'tampered'")).rejects.toThrow(/star-immutable/);
    await expect(pglite.query('DELETE FROM b1_anchor')).rejects.toThrow(/star-immutable/);
    await expect(pglite.query("UPDATE b1_narrative_asset SET attribution_basis = 'name-match'")).rejects.toThrow(/star-immutable/);
  });

  it('direction + referential discipline: edges require recorded endpoints', async () => {
    await expect(
      recordEventNarrativeLink(db, {
        eventKey: 'evt-does-not-exist',
        narrativeKey: 'nar-fixture-ai-agents',
        relation: 'produces',
        observedAt: '2026-09-04T00:00:00.000Z',
        sourceId: 'synthetic-fixtures',
        payload: {},
      }),
    ).rejects.toThrow(/B1 referential: event/);

    await expect(
      recordNarrativeAsset(db, {
        narrativeKey: 'nar-does-not-exist',
        assetId: 'SomeMint1111111111111111111111111111111111',
        universe: 'U-01-SOLANA',
        venue: 'pump.fun-bonding-curve',
        attributionBasis: 'labeled',
        observedAt: '2026-09-04T00:00:00.000Z',
        sourceId: 'synthetic-fixtures',
        payload: {},
      }),
    ).rejects.toThrow(/B1 referential: narrative/);
  });

  it('contract validation rejects unknown enums and non-UTC timestamps', async () => {
    await expect(
      recordEventNarrativeLink(db, {
        eventKey: 'evt-fixture-ai-agents',
        narrativeKey: 'nar-fixture-ai-agents',
        relation: 'caused-by-narrative',
        observedAt: '2026-09-04T00:00:00.000Z',
        sourceId: 'synthetic-fixtures',
        payload: {},
      }),
    ).rejects.toThrow(/relation must be one of/);

    await expect(
      recordAnchor(db, {
        narrativeKey: 'nar-fixture-ai-agents',
        anchor: 'T_first_moon',
        anchoredAt: '2026-09-04T00:00:00.000Z',
        basis: 'observed',
        sourceId: 'synthetic-fixtures',
        observedAt: '2026-09-04T00:00:00.000Z',
        payload: {},
      }),
    ).rejects.toThrow(/anchor must be one of/);

    await expect(
      recordAnchor(db, {
        narrativeKey: 'nar-fixture-ai-agents',
        anchor: 'T_seed',
        anchoredAt: '2026-09-04T00:00:00+08:00',
        basis: 'labeled',
        sourceId: 'synthetic-fixtures',
        observedAt: '2026-09-04T00:00:00.000Z',
        payload: {},
      }),
    ).rejects.toThrow(/ISO UTC/);
  });
});
