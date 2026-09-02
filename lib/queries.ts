import { eq, desc, inArray, and, lte } from 'drizzle-orm';
import * as s from '@/db/schema';
import { StarDb } from './db';

export async function getProjectsWithReadiness(db: StarDb) {
  const rows = await db.select().from(s.projects).orderBy(desc(s.projects.decisionReadiness));
  const scoreMap = new Map<string, { total: number; confidence: number }>();
  const gateMap = new Map<string, { status: string; category: string }[]>();

  const narrativeIds = Array.from(new Set(rows.map(r => r.narrativeId)));
  const narratives = await db.select().from(s.narratives).where(inArray(s.narratives.id, narrativeIds));
  const narrativeNameMap = new Map(narratives.map(n => [n.id, n.name]));

  const scores = await db.select().from(s.scores);
  for (const sc of scores) scoreMap.set(sc.projectId, { total: sc.total, confidence: sc.confidence });

  const gates = await db.select().from(s.gates);
  for (const g of gates) {
    if (!gateMap.has(g.projectId)) gateMap.set(g.projectId, []);
    gateMap.get(g.projectId)!.push({ status: g.status, category: g.category });
  }

  return rows.map(p => ({
    ...p,
    narrativeName: narrativeNameMap.get(p.narrativeId) || p.narrativeId,
    score: scoreMap.get(p.id),
    gates: gateMap.get(p.id) || [],
  }));
}

export async function getNarratives(db: StarDb) {
  return db.select().from(s.narratives).orderBy(desc(s.narratives.updatedAt));
}

export async function getProjectDetail(db: StarDb, projectId: string) {
  const [project] = await db.select().from(s.projects).where(eq(s.projects.id, projectId));
  const [narrative] = await db.select().from(s.narratives).where(eq(s.narratives.id, project.narrativeId));
  const [token] = await db.select().from(s.tokens).where(eq(s.tokens.projectId, projectId));
  const poolRows = await db.select().from(s.pools).where(eq(s.pools.projectId, projectId));
  const evidenceRows = await db.select().from(s.evidence).where(eq(s.evidence.projectId, projectId)).orderBy(desc(s.evidence.observedAt));
  const gateRows = await db.select().from(s.gates).where(eq(s.gates.projectId, projectId));
  const [score] = await db.select().from(s.scores).where(eq(s.scores.projectId, projectId)).orderBy(desc(s.scores.computedAt)).limit(1);
  const walletRows = await db.select().from(s.wallets).where(eq(s.wallets.projectId, projectId));
  const entityRows = await db.select().from(s.entities).where(eq(s.entities.projectId, projectId));
  const edgeRows = await db.select().from(s.graphEdges).where(eq(s.graphEdges.projectId, projectId));
  const [decision] = await db.select().from(s.decisions).where(eq(s.decisions.projectId, projectId)).limit(1);
  return { project, narrative, token, pools: poolRows, evidence: evidenceRows, gates: gateRows, score, wallets: walletRows, entities: entityRows, edges: edgeRows, decision };
}

export async function getEvidenceBefore(db: StarDb, projectId: string, asOf: Date) {
  return db.select().from(s.evidence).where(and(eq(s.evidence.projectId, projectId), lte(s.evidence.observedAt, asOf)));
}
