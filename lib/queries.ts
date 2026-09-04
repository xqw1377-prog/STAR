import { eq, desc, inArray, and, lte, gt } from 'drizzle-orm';
import * as s from '@/db/schema';
import { StarDb } from './db';
import { evaluateProjectAsOf, type ProjectEvaluation } from './engine';
import { projectDeskHealth, type DeskHealth } from '@/lib/data/health';
import {
  DEFAULT_ARTIFACTS,
  freezeInterpretationContext,
  historicalEvaluate,
  reinterpretEvaluate,
} from '@/lib/data/historical';
import { loadEvidenceLineage, type EvidenceLineage } from '@/lib/data/lineage';

export type ProjectWithEvaluation = Awaited<ReturnType<typeof getProjectsWithReadiness>>[number];

export async function getProjectsWithReadiness(db: StarDb) {
  const rows = await db.select().from(s.projects);
  const narrativeIds = Array.from(new Set(rows.map((r) => r.narrativeId)));
  const narratives = narrativeIds.length
    ? await db.select().from(s.narratives).where(inArray(s.narratives.id, narrativeIds))
    : [];
  const narrativeNameMap = new Map(narratives.map((n) => [n.id, n.name]));
  const now = new Date();
  const out: Array<typeof rows[number] & {
    narrativeName: string;
    evaluation: ProjectEvaluation;
    score: { total: number; confidence: number } | undefined;
    gates: { status: string; category: string }[];
  }> = [];
  for (const p of rows) {
    const evaluation = await evaluateProjectAsOf(db, p.id, now);
    out.push({
      ...p,
      narrativeName: narrativeNameMap.get(p.narrativeId) || p.narrativeId,
      evaluation,
      score: evaluation.score ? { total: evaluation.score.total, confidence: evaluation.score.confidence } : undefined,
      gates: evaluation.gates.map((g) => ({ status: g.status, category: g.gate })),
    });
  }
  return out.sort((a, b) => (b.evaluation.readiness === 'READY' ? 1 : 0) - (a.evaluation.readiness === 'READY' ? 1 : 0));
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
  const evaluation = await evaluateProjectAsOf(db, projectId, new Date());
  const lineage = await loadEvidenceLineage(db, projectId);
  return {
    project, narrative, token, pools: poolRows, evidence: evidenceRows, gates: gateRows,
    score, wallets: walletRows, entities: entityRows, edges: edgeRows, decision, evaluation, lineage,
  };
}

export async function getEvidenceBefore(db: StarDb, projectId: string, asOf: Date) {
  return db.select().from(s.evidence).where(and(
    eq(s.evidence.projectId, projectId),
    lte(s.evidence.observedAt, asOf),
    lte(s.evidence.effectiveAt, asOf),
    lte(s.evidence.ingestedAt, asOf),
  ));
}

export async function getDeskHealth(db: StarDb, now = new Date()): Promise<DeskHealth> {
  return projectDeskHealth(db, now);
}

export type ReplayMode = 'HISTORICAL' | 'REINTERPRET';

export type ReplayRun = {
  mode: ReplayMode;
  contextId: string | null;
  artifacts: typeof DEFAULT_ARTIFACTS;
  evaluation: ProjectEvaluation;
  evidenceVisible: typeof s.evidence.$inferSelect[];
  evidenceHidden: number;
  lineage: EvidenceLineage[];
};

export async function runReplay(
  db: StarDb,
  args: { projectId: string; asOf: Date; mode: ReplayMode },
): Promise<ReplayRun> {
  const visible = await db
    .select()
    .from(s.evidence)
    .where(and(
      eq(s.evidence.projectId, args.projectId),
      lte(s.evidence.observedAt, args.asOf),
      lte(s.evidence.ingestedAt, args.asOf),
    ));
  const future = await db
    .select({ id: s.evidence.id })
    .from(s.evidence)
    .where(and(eq(s.evidence.projectId, args.projectId), gt(s.evidence.observedAt, args.asOf)));
  const lineage = await loadEvidenceLineage(db, args.projectId);

  if (args.mode === 'HISTORICAL') {
    const contextId = await freezeInterpretationContext(db, {
      projectId: args.projectId,
      asOf: args.asOf,
      mode: 'HISTORICAL',
    });
    const evaluation = await historicalEvaluate(db, contextId);
    return {
      mode: 'HISTORICAL',
      contextId,
      artifacts: DEFAULT_ARTIFACTS,
      evaluation,
      evidenceVisible: visible.sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime()),
      evidenceHidden: future.length,
      lineage,
    };
  }

  const live = await reinterpretEvaluate(db, args.projectId, args.asOf);
  return {
    mode: live.mode,
    contextId: live.contextId,
    artifacts: DEFAULT_ARTIFACTS,
    evaluation: live.evaluation,
    evidenceVisible: visible.sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime()),
    evidenceHidden: future.length,
    lineage,
  };
}
