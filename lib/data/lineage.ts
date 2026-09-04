/**
 * T03b surface: evidence.hash → receipt.payload_hash → fact.id.
 * Unlinked fixture rows stay visible as UNLINKED; they are not invented receipts.
 */
import { eq } from 'drizzle-orm';
import * as s from '@/db/schema';
import type { StarDb } from '@/lib/db';
import { sha256hex } from './hash';
import { resolveFactPayload, resolvePayload } from './resolve';

export type LineageStatus = 'LINKED' | 'UNLINKED' | 'PURGED' | 'ERASED';

export type EvidenceLineage = {
  evidenceId: number;
  evidenceType: string;
  observedAt: Date;
  evidenceHash: string | null;
  receiptId: string | null;
  payloadHash: string | null;
  factId: string | null;
  status: LineageStatus;
};

export async function loadEvidenceLineage(db: StarDb, projectId: string): Promise<EvidenceLineage[]> {
  const evidence = await db.select().from(s.evidence).where(eq(s.evidence.projectId, projectId));
  const receipts = await db.select().from(s.rawReceipts);
  const facts = await db.select().from(s.normalizedFacts);
  const receiptByHash = new Map(receipts.map((r) => [r.payloadHash, r]));
  const factByReceipt = new Map<string, typeof facts[number]>();
  for (const fact of facts) {
    if (fact.subjectId === projectId && !factByReceipt.has(fact.receiptId)) {
      factByReceipt.set(fact.receiptId, fact);
    }
  }

  const out: EvidenceLineage[] = [];
  for (const row of evidence) {
    const computed = await sha256hex(JSON.stringify(row.payload ?? {}));
    const receipt = (row.hash ? receiptByHash.get(row.hash) : undefined)
      ?? receiptByHash.get(computed);
    const fact = receipt ? factByReceipt.get(receipt.id) : undefined;
    let status: LineageStatus = receipt ? 'LINKED' : 'UNLINKED';
    if (receipt) {
      const raw = await resolvePayload(db, receipt.id);
      if (raw.status === 'PURGED') status = 'PURGED';
    }
    if (fact) {
      const derived = await resolveFactPayload(db, fact.id);
      if (derived.status === 'ERASED') status = 'ERASED';
    }
    out.push({
      evidenceId: row.id,
      evidenceType: row.type,
      observedAt: row.observedAt,
      evidenceHash: row.hash,
      receiptId: receipt?.id ?? null,
      payloadHash: receipt?.payloadHash ?? row.hash ?? null,
      factId: fact?.id ?? null,
      status,
    });
  }
  return out.sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime());
}

export function shortHash(value: string | null): string {
  if (!value) return '—';
  return value.length <= 12 ? value : `${value.slice(0, 8)}…${value.slice(-4)}`;
}
