/**
 * Server-side seeding of the filesystem PGlite store (used by API routes,
 * e2e tests and the real-RPC collection path). The browser idb store seeds
 * itself via lib/db.ts with the same fixtures.
 */
import type { StarDb } from '@/lib/db';
import * as s from './schema';
import * as fixtures from './fixtures';
import { refreshProject } from '@/lib/engine';

export async function seedDatabase(db: StarDb) {
  await db.delete(s.graphEdges);
  await db.delete(s.wallets);
  await db.delete(s.entities);
  await db.delete(s.evidence);
  await db.delete(s.pools);
  await db.delete(s.tokens);
  await db.delete(s.scores);
  await db.delete(s.gates);
  await db.delete(s.decisions);
  await db.delete(s.shadowPositions);
  await db.delete(s.projects);
  await db.delete(s.narratives);
  await db.delete(s.chains);

  await db.insert(s.chains).values(fixtures.chains);
  await db.insert(s.narratives).values(fixtures.narratives);
  await db.insert(s.projects).values(fixtures.projects);
  await db.insert(s.tokens).values(fixtures.tokens);
  await db.insert(s.pools).values(fixtures.pools);
  await db.insert(s.evidence).values(fixtures.evidence);
  await db.insert(s.wallets).values(fixtures.wallets);
  await db.insert(s.entities).values(fixtures.entities);
  await db.insert(s.graphEdges).values(fixtures.graphEdges);

  const evaluations: Record<string, { allPass: boolean; score: number }> = {};
  for (const p of fixtures.projects) {
    const evaluation = await refreshProject(db, p.id);
    evaluations[p.id] = { allPass: evaluation.allPass, score: evaluation.score?.total ?? 0 };
  }

  return { ok: true, projects: fixtures.projects.length, evidence: fixtures.evidence.length, evaluations };
}
