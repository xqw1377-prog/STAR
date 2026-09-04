import { and, eq, ne } from 'drizzle-orm';
import * as s from '@/db/schema';
import type { StarDb } from '@/lib/db';
import { newLedgerId } from './hash';

export async function linkReceipts(
  db: StarDb,
  args: {
    receiptId: string;
    relatedReceiptId: string;
    relation: 'SUPERSEDES' | 'CONTESTS' | 'DUPLICATES';
    basis: string;
    creatorRef: string;
  },
): Promise<string> {
  const id = newLedgerId('rrel');
  await db.insert(s.receiptRelations).values({
    id,
    receiptId: args.receiptId,
    relatedReceiptId: args.relatedReceiptId,
    relation: args.relation,
    basis: args.basis,
    creatorRef: args.creatorRef,
    createdAt: new Date(),
  });
  return id;
}

export async function contestSiblings(
  db: StarDb,
  receiptId: string,
  observationKey: string,
  payloadHash: string,
  anchorSlot: number | null,
  anchorTime: Date,
): Promise<void> {
  const others = await db.select().from(s.rawReceipts).where(
    and(eq(s.rawReceipts.observationKey, observationKey), ne(s.rawReceipts.id, receiptId)),
  );
  for (const other of others) {
    if (other.payloadHash === payloadHash) continue;
    const sameSlot = anchorSlot != null && other.anchorSlot === anchorSlot;
    const sameTime = Boolean(other.anchorTime && other.anchorTime.getTime() === anchorTime.getTime());
    if (!sameSlot && !sameTime) continue;
    await linkReceipts(db, {
      receiptId,
      relatedReceiptId: other.id,
      relation: 'CONTESTS',
      basis: 'divergent-payload-same-observation-anchor',
      creatorRef: 'collector',
    });
  }
}

export async function resolveContest(
  db: StarDb,
  args: {
    relationId: string;
    resolvedReceiptId: string;
    basis: 'FINALIZED_SLOT' | 'SOURCE_PRIORITY' | 'MANUAL_AUDIT';
    basisVersion: string;
    authorizationRef: string;
  },
): Promise<string> {
  const id = newLedgerId('cres');
  await db.insert(s.contestResolutions).values({
    id,
    contestedRelation: args.relationId,
    basis: args.basis,
    basisVersion: args.basisVersion,
    resolvedReceiptId: args.resolvedReceiptId,
    authorizationRef: args.authorizationRef,
    createdAt: new Date(),
  });
  return id;
}

export async function contradictFacts(
  db: StarDb,
  factA: string,
  factB: string,
): Promise<string> {
  const id = newLedgerId('frel');
  await db.insert(s.factRelations).values({
    id,
    factA,
    factB,
    relation: 'CONTRADICTS',
    createdAt: new Date(),
  });
  return id;
}

export async function resolveFactConflict(
  db: StarDb,
  args: {
    factRelationId: string;
    resolvedFactId: string;
    basis: 'SOURCE_PRIORITY' | 'MANUAL_AUDIT';
    basisVersion: string;
    authorizationRef: string;
  },
): Promise<string> {
  const id = newLedgerId('fres');
  await db.insert(s.factResolutions).values({
    id,
    factRelationId: args.factRelationId,
    basis: args.basis,
    basisVersion: args.basisVersion,
    resolvedFactId: args.resolvedFactId,
    authorizationRef: args.authorizationRef,
    createdAt: new Date(),
  });
  return id;
}

export async function registerArtifact(
  db: StarDb,
  args: { id?: string; kind: string; version: string; contentHash: string; contentRef: string },
): Promise<string> {
  const id = args.id ?? newLedgerId('art');
  await db.insert(s.artifactRegistry).values({
    id,
    kind: args.kind,
    version: args.version,
    contentHash: args.contentHash,
    contentRef: args.contentRef,
    createdAt: new Date(),
  });
  return id;
}
