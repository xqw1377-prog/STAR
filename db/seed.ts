/**
 * Server-side seeding of the filesystem PGlite store (used by API routes,
 * e2e tests and the real-RPC collection path). The browser idb store seeds
 * itself via lib/db.ts with the same fixtures.
 */
import type { StarDb } from '@/lib/db';
import * as s from './schema';
import * as fixtures from './fixtures';
import { evaluateProjectAsOf, persistEvaluation } from '@/lib/engine';
import { backfillLedgerFromEvidence, wipeLedger } from '@/lib/data/ledger-seed';

export async function seedDatabase(db: StarDb) {
  // 全量重建必须原子：任何一步失败都回滚到既有快照，绝不留下部分写入的
  // 中间状态（gates/scores 存在但 projects 缺失等）。M2。
  return db.transaction(async (tx) => {
    await wipeLedger(tx as unknown as StarDb);
    await tx.delete(s.graphEdges);
    await tx.delete(s.wallets);
    await tx.delete(s.entities);
    await tx.delete(s.evidence);
    await tx.delete(s.pools);
    await tx.delete(s.tokens);
    await tx.delete(s.scores);
    await tx.delete(s.gates);
    await tx.delete(s.decisions);
    await tx.delete(s.shadowPositions);
    await tx.delete(s.projects);
    await tx.delete(s.narratives);
    await tx.delete(s.chains);

    await tx.insert(s.chains).values(fixtures.chains);
    await tx.insert(s.narratives).values(fixtures.narratives);
    await tx.insert(s.projects).values(fixtures.projects);
    await tx.insert(s.tokens).values(fixtures.tokens);
    await tx.insert(s.pools).values(fixtures.pools);
    await tx.insert(s.evidence).values(fixtures.evidence);
    await tx.insert(s.wallets).values(fixtures.wallets);
    await tx.insert(s.entities).values(fixtures.entities);
    await tx.insert(s.graphEdges).values(fixtures.graphEdges);

    const evaluations: Record<string, { allPass: boolean; score: number }> = {};
    for (const p of fixtures.projects) {
      // 在同一条重建事务内评估并落库，避免嵌套事务（M2）。
      const evaluation = await evaluateProjectAsOf(tx as unknown as StarDb, p.id, new Date());
      await persistEvaluation(tx as unknown as StarDb, evaluation);
      evaluations[p.id] = { allPass: evaluation.allPass, score: evaluation.score?.total ?? 0 };
    }

    await backfillLedgerFromEvidence(tx as unknown as StarDb);

    return { ok: true, projects: fixtures.projects.length, evidence: fixtures.evidence.length, evaluations };
  });
}
