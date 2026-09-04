/* eslint-disable @typescript-eslint/no-explicit-any -- PGlite handle typed loosely for trigger tests */
/**
 * T01 (D0 acceptance): database-layer immutability of the append-only ledger.
 * The DB itself must reject UPDATE/DELETE — not merely the repository's
 * failure to expose update methods. Correction = append; legitimate
 * start→complete→link flows must be unaffected (no lease-renewal path exists:
 * lease is frozen at Start; renewal is modeled as a new attempt).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { readFile } from 'fs/promises';
import type { PGlite } from '@electric-sql/pglite';

process.env.PGLITE_DATA_DIR = mkdtempSync(join(tmpdir(), 'star-imm-'));

type CountRow = { n: number };
type HashRow = { payload_hash: string };
type RetiredRow = { retired_at: Date | string | null };

let pglite: PGlite;

beforeAll(async () => {
  const { PGlite: PGliteCtor } = await import('@electric-sql/pglite');
  const { ensureCoreAndD1 } = await import('@/db/apply-sql');
  pglite = new PGliteCtor(process.env.PGLITE_DATA_DIR);
  await pglite.waitReady;
  await ensureCoreAndD1(
    pglite,
    async (name) => readFile(join(process.cwd(), 'public', name), 'utf8'),
  );
});

const IMMUTABLE = [
  'collection_attempt',
  'attempt_outcome_event',
  'attempt_receipt_link',
  'raw_receipt',
  'normalized_fact',
  'receipt_relation',
];

describe('DB immutability triggers (T01)', () => {
  it('legit append flow works: attempt → outcome → receipt → link (no false positives)', async () => {
    await pglite.query(
      `INSERT INTO collection_attempt (id, observation_key, project_id, fact_kind, source_id, method_id,
         attempt_origin, started_at, lease_expires_at, request_params_sanitized)
       VALUES ('a1','q1','proj-neural','liquidity','synthetic-fixtures','fixture:all',
         'INITIAL','2026-09-01T00:00:00Z','2026-09-01T00:01:00Z','{}')`,
    );
    await pglite.query(
      `INSERT INTO attempt_outcome_event (id, attempt_id, outcome, response_bytes_received, completed_at)
       VALUES ('o1','a1','SUCCESS',1,'2026-09-01T00:00:05Z')`,
    );
    await pglite.query(
      `INSERT INTO raw_receipt (id, receipt_key, observation_key, creator_outcome_event_id,
         anchor_time, payload_hash, payload_ref, status, created_at)
       VALUES ('rc1','rk1','q1','o1','2026-09-01T00:00:04Z','h1','b1','SUCCESS','2026-09-01T00:00:05Z')`,
    );
    await pglite.query(
      `INSERT INTO attempt_receipt_link (id, outcome_event_id, receipt_id)
       VALUES ('l1','o1','rc1')`,
    );
    const rows = await pglite.query<CountRow>('SELECT count(*)::int AS n FROM attempt_receipt_link');
    expect(rows.rows[0].n).toBe(1);

    // Second attempt/outcome for the CONTESTED sibling receipt (creator FK is UNIQUE).
    await pglite.query(
      `INSERT INTO collection_attempt (id, observation_key, project_id, fact_kind, source_id, method_id,
         attempt_origin, started_at, lease_expires_at, request_params_sanitized)
       VALUES ('a2','q1','proj-neural','liquidity','synthetic-fixtures','fixture:all',
         'RETRY','2026-09-01T00:00:02Z','2026-09-01T00:01:00Z','{}')`,
    );
    await pglite.query(
      `INSERT INTO attempt_outcome_event (id, attempt_id, outcome, response_bytes_received, completed_at)
       VALUES ('o2','a2','SUCCESS',1,'2026-09-01T00:00:06Z')`,
    );
    await pglite.query(
      `INSERT INTO raw_receipt (id, receipt_key, observation_key, creator_outcome_event_id,
         anchor_time, payload_hash, payload_ref, status, created_at)
       VALUES ('rc2','rk2','q1','o2','2026-09-01T00:00:04Z','h2','b2','SUCCESS','2026-09-01T00:00:06Z')`,
    );
    await pglite.query(
      `INSERT INTO attempt_receipt_link (id, outcome_event_id, receipt_id)
       VALUES ('l2','o2','rc2')`,
    );

    await pglite.query(
      `INSERT INTO receipt_relation (id, receipt_id, related_receipt_id, relation, basis, creator_ref, created_at)
       VALUES ('rr0','rc1','rc2','DUPLICATES','seed','test-runner','2026-09-01T00:00:08Z')`,
    );

    // Seed remaining tables so row-level triggers fire in later UPDATE/DELETE tests.
    await pglite.query(
      `INSERT INTO normalized_fact (id, receipt_id, fact_kind, subject_type, subject_id, payload_hash,
         fact_payload_ref, parser_version, fact_local_key, effective_time_kind, created_at)
       VALUES ('f1','rc1','liquidity','project','proj-neural','fh1','fb1','v1','singleton','OBSERVATION_BOUND','2026-09-01T00:00:05Z')`,
    );
  });

  for (const table of IMMUTABLE) {
    it(`UPDATE ${table} is rejected by the database`, async () => {
      const pk = {
        collection_attempt: 'id',
        attempt_outcome_event: 'id',
        attempt_receipt_link: 'id',
        raw_receipt: 'id',
        normalized_fact: 'id',
        receipt_relation: 'id',
      }[table]!;
      await expect(
        pglite.query(`UPDATE ${table} SET id = id WHERE ${pk} IS NOT NULL`),
      ).rejects.toThrow(/star-immutable/);
    });

    it(`DELETE ${table} is rejected by the database`, async () => {
      await expect(pglite.query(`DELETE FROM ${table}`)).rejects.toThrow(/star-immutable/);
    });
  }

  it('correction is append-only: a second receipt row inserts; the first is untouched', async () => {
    // same observation, different bytes → CONTESTED sibling, not an update
    await pglite.query(
      `INSERT INTO collection_attempt (id, observation_key, project_id, fact_kind, source_id, method_id,
         attempt_origin, started_at, lease_expires_at, request_params_sanitized)
       VALUES ('a3','q1','proj-neural','liquidity','synthetic-fixtures','fixture:all',
         'SCHEDULER_REISSUE','2026-09-01T00:00:03Z','2026-09-01T00:01:00Z','{}')`,
    );
    await pglite.query(
      `INSERT INTO attempt_outcome_event (id, attempt_id, outcome, response_bytes_received, completed_at)
       VALUES ('o3','a3','PARTIAL',1,'2026-09-01T00:00:07Z')`,
    );
    await pglite.query(
      `INSERT INTO raw_receipt (id, receipt_key, observation_key, creator_outcome_event_id,
         anchor_time, payload_hash, payload_ref, status, created_at)
       VALUES ('rc3','rk3','q1','o3','2026-09-01T00:00:04Z','h3','b3','PARTIAL','2026-09-01T00:00:07Z')`,
    );
    await pglite.query(
      `INSERT INTO receipt_relation (id, receipt_id, related_receipt_id, relation, basis, creator_ref, created_at)
       VALUES ('rr1','rc1','rc2','CONTESTS','test','test-runner','2026-09-01T00:00:08Z')`,
    );
    const rows = await pglite.query<HashRow>(
      'SELECT payload_hash FROM raw_receipt WHERE id = $1',
      ['rc1'],
    );
    expect(rows.rows[0].payload_hash).toBe('h1'); // first row untouched
  });

  it('mutable-by-design tables are not blocked (plan_item lifecycle, blob purge)', async () => {
    await pglite.query(
      `INSERT INTO collection_plan_item (id, source_id, method_id, subject_project, expected_fact_kind,
         observation_template, plan_version, created_at)
       VALUES ('p1','synthetic-fixtures','fixture:all','proj-neural','liquidity','{}','v1','2026-09-01T00:00:00Z')
       ON CONFLICT DO NOTHING`,
    );
    // retired_at lifecycle is an intentional UPDATE on plan items
    await pglite.query(`UPDATE collection_plan_item SET retired_at = '2026-09-02T00:00:00Z' WHERE id = 'p1'`);
    const rows = await pglite.query<RetiredRow>('SELECT retired_at FROM collection_plan_item WHERE id = $1', ['p1']);
    expect(rows.rows[0].retired_at).not.toBeNull();
  });
});
