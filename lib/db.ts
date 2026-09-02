/* eslint-disable @typescript-eslint/no-explicit-any -- untrusted external JSON is parsed defensively at this boundary */
// PGlite is imported dynamically inside initDb so the server bundle never
// statically links it (browser idb path only; see db/client.ts for server).
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import * as fixtures from '@/db/star-fixtures';
import { refreshProject } from './star-engine';

export type StarDb = ReturnType<typeof drizzle<typeof schema>>;

let pgliteInstance: any = null;
let dbInstance: StarDb | null = null;

export async function initDb(): Promise<StarDb> {
  if (dbInstance) return dbInstance;
  const { PGlite } = await import('@electric-sql/pglite');
  pgliteInstance = new PGlite('idb://star');
  await pgliteInstance.waitReady;

  const initSql = await fetch('/init.sql').then(r => r.text());
  const cleaned = initSql
    .split('\n')
    .map(l => l.replace(/^--> statement-breakpoint$/g, ''))
    .filter(l => !/^-->/.test(l.trim()))
    .join('\n');

  try {
    await pgliteInstance.query('SELECT 1 FROM projects LIMIT 1');
  } catch {
    await pgliteInstance.exec(cleaned);
  }

  dbInstance = drizzle(pgliteInstance, { schema });

  // Reseed when the store predates the P0-DATA timeline (no contract-typed
  // evidence) so stale browser databases migrate to the v2 fixture history.
  const existing = await dbInstance.select().from(schema.projects).limit(1);
  if (existing.length) {
    const timelineRows = await dbInstance.select().from(schema.evidence).limit(200);
    const hasTimeline = timelineRows.some((r: any) => r.type === 'mint-authority');
    if (!hasTimeline) await reseed(dbInstance);
  } else {
    await seed(dbInstance);
  }

  return dbInstance;
}

async function reseed(db: StarDb) {
  await db.delete(schema.graphEdges);
  await db.delete(schema.wallets);
  await db.delete(schema.entities);
  await db.delete(schema.evidence);
  await db.delete(schema.pools);
  await db.delete(schema.tokens);
  await db.delete(schema.scores);
  await db.delete(schema.gates);
  await db.delete(schema.decisions);
  await db.delete(schema.shadowPositions);
  await db.delete(schema.projects);
  await db.delete(schema.narratives);
  await db.delete(schema.chains);
  await seed(db);
}

async function seed(db: StarDb) {
  await db.insert(schema.chains).values(fixtures.chains);
  await db.insert(schema.narratives).values(fixtures.narratives);
  await db.insert(schema.projects).values(fixtures.projects);
  await db.insert(schema.tokens).values(fixtures.tokens);
  await db.insert(schema.pools).values(fixtures.pools);
  await db.insert(schema.evidence).values(fixtures.evidence);
  await db.insert(schema.wallets).values(fixtures.wallets);
  await db.insert(schema.entities).values(fixtures.entities);
  await db.insert(schema.graphEdges).values(fixtures.graphEdges);

  for (const p of fixtures.projects) {
    await refreshProject(db, p.id);
  }
}

export function getDb(): StarDb {
  if (!dbInstance) throw new Error('Database not initialized. Call initDb() first.');
  return dbInstance;
}
