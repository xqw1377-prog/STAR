import * as s from '@/db/schema';
import type { StarDb } from '@/lib/db';
import { FACT_KINDS } from './contract';
import { backfillSuccessFromEvidence, ensurePlanItem } from './ledger';
import { ensureDefaultArtifacts } from './historical';

const GATE_TYPES = new Set<string>(FACT_KINDS);

export async function wipeLedger(db: StarDb): Promise<void> {
  await db.delete(s.contestResolutions);
  await db.delete(s.factResolutions);
  await db.delete(s.factErasures);
  await db.delete(s.receiptRelations);
  await db.delete(s.factRelations);
  await db.delete(s.interpretationContextParsers);
  await db.delete(s.interpretationContextFacts);
  await db.delete(s.interpretationContexts);
  await db.delete(s.blobRefcounts);
  await db.delete(s.rawDispositions);
  await db.delete(s.attemptReceiptLinks);
  await db.delete(s.normalizedFacts);
  await db.delete(s.rawReceipts);
  await db.delete(s.attemptOutcomes);
  await db.delete(s.collectionAttempts);
  await db.delete(s.rawBlobs);
  await db.delete(s.collectionPlanItems);
  await db.delete(s.artifactRegistry);
}

export async function ensureProjectPlans(
  db: StarDb,
  projectId: string,
  sourceId = 'fixture',
): Promise<void> {
  for (const kind of FACT_KINDS) {
    await ensurePlanItem(db, {
      sourceId,
      methodId: kind,
      projectId,
      factKind: kind,
    });
  }
}

export async function backfillLedgerFromEvidence(db: StarDb, sourceId = 'fixture'): Promise<void> {
  const projects = await db.select().from(s.projects);
  for (const p of projects) {
    await ensureProjectPlans(db, p.id, sourceId);
  }
  const rows = await db.select().from(s.evidence);
  for (const row of rows) {
    if (!GATE_TYPES.has(row.type)) continue;
    await backfillSuccessFromEvidence(db, {
      projectId: row.projectId,
      factKind: row.type,
      sourceId: row.source || sourceId,
      payload: row.payload,
      observedAt: row.observedAt,
      ingestedAt: row.ingestedAt,
    });
  }
  await ensureDefaultArtifacts(db);
}
