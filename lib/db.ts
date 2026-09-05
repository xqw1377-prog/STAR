/* eslint-disable @typescript-eslint/no-explicit-any -- untrusted external JSON is parsed defensively at this boundary */
// PGlite is imported dynamically inside initDb so the server bundle never
// statically links it (browser idb path only; see db/client.ts for server).
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import * as fixtures from '@/db/star-fixtures';
import { evaluateProjectAsOf, persistEvaluation } from './star-engine';
import { ensureCoreAndD1 } from '@/db/apply-sql';
import { backfillLedgerFromEvidence } from '@/lib/data/ledger-seed';

export type StarDb = ReturnType<typeof drizzle<typeof schema>>;

let pgliteInstance: any = null;
let dbInstance: StarDb | null = null;

/**
 * Browser idb init must be strictly serialized: React double-mounts and the
 * dynamic ssr:false boundary can load two module instances, and two PGlite
 * handles racing on the same idb:// store interleave DDL/seed halfway.
 * Web Locks serialize across every module instance on the origin.
 */
export async function initDb(): Promise<StarDb> {
  if (dbInstance) return dbInstance;
  const locks = (globalThis as { navigator?: { locks?: { request: (name: string, fn: () => Promise<StarDb>) => Promise<StarDb> } } }).navigator?.locks;
  if (locks) {
    return locks.request('star-db-init', async () => {
      if (dbInstance) return dbInstance;
      dbInstance = await buildDb();
      return dbInstance;
    });
  }
  dbInstance = await buildDb();
  return dbInstance;
}

async function buildDb(): Promise<StarDb> {
  const { PGlite } = await import('@electric-sql/pglite');
  pgliteInstance = new PGlite('idb://star');
  await pgliteInstance.waitReady;

  await ensureCoreAndD1(pgliteInstance, (name) => fetch(`/${name}`).then((r) => r.text()));

  const db = drizzle(pgliteInstance, { schema });

  // Reseed when the store predates the P0-DATA timeline (no contract-typed
  // evidence) so stale browser databases migrate to the v2 fixture history.
  const existing = await db.select().from(schema.projects).limit(1);
  if (existing.length) {
    const timelineRows = await db.select().from(schema.evidence).limit(200);
    const hasTimeline = timelineRows.some((r: any) => r.type === 'mint-authority');
    if (!hasTimeline) await reseed(db);
    else {
      const attempts = await db.select().from(schema.collectionAttempts).limit(1);
      if (!attempts.length) await backfillLedgerFromEvidence(db);
    }
  } else {
    await seed(db);
  }

  return db;
}

/** 单事务内的灌库核心步骤（供 seed/reseed 复用，避免嵌套事务）。M2。 */
async function seedInner(db: StarDb) {
  await db.insert(schema.chains).values(fixtures.chains).onConflictDoNothing();
  await db.insert(schema.narratives).values(fixtures.narratives).onConflictDoNothing();
  await db.insert(schema.projects).values(fixtures.projects).onConflictDoNothing();
  await db.insert(schema.tokens).values(fixtures.tokens).onConflictDoNothing();
  await db.insert(schema.pools).values(fixtures.pools).onConflictDoNothing();
  await db.insert(schema.evidence).values(fixtures.evidence).onConflictDoNothing();
  await db.insert(schema.wallets).values(fixtures.wallets).onConflictDoNothing();
  await db.insert(schema.entities).values(fixtures.entities).onConflictDoNothing();
  await db.insert(schema.graphEdges).values(fixtures.graphEdges).onConflictDoNothing();

  for (const p of fixtures.projects) {
    // 复用调用方已开启的事务直接落库，避免嵌套事务（M2）。
    const evaluation = await evaluateProjectAsOf(db, p.id, new Date());
    await persistEvaluation(db, evaluation);
  }
  await backfillLedgerFromEvidence(db);
}

async function seed(db: StarDb) {
  return db.transaction(async (tx) => {
    await seedInner(tx as unknown as StarDb);
  });
}

async function reseed(db: StarDb) {
  const { wipeLedger } = await import('@/lib/data/ledger-seed');
  return db.transaction(async (tx) => {
    await wipeLedger(tx as unknown as StarDb);
    await tx.delete(schema.graphEdges);
    await tx.delete(schema.wallets);
    await tx.delete(schema.entities);
    await tx.delete(schema.evidence);
    await tx.delete(schema.pools);
    await tx.delete(schema.tokens);
    await tx.delete(schema.scores);
    await tx.delete(schema.gates);
    await tx.delete(schema.decisions);
    await tx.delete(schema.shadowPositions);
    await tx.delete(schema.projects);
    await tx.delete(schema.narratives);
    await tx.delete(schema.chains);
    await seedInner(tx as unknown as StarDb);
  });
}

export function getDb(): StarDb {
  if (!dbInstance) throw new Error('Database not initialized. Call initDb() first.');
  return dbInstance;
}
