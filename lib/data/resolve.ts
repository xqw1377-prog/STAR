/**
 * Disposition projections. Never write tombstone bytes at the original hash.
 * resolvePayload → BYTES | PURGED | MISSING
 * resolveFactPayload → PAYLOAD | ERASED
 */
import { eq } from 'drizzle-orm';
import * as s from '@/db/schema';
import type { StarDb } from '@/lib/db';

export type PayloadProjection =
  | { status: 'BYTES'; body: string; payloadHash: string }
  | { status: 'PURGED'; payloadHash: string; replay: 'RAW_SOURCE_PURGED' | 'REPLAY_SOURCE_PURGED' }
  | { status: 'MISSING'; payloadHash: string };

export type FactPayloadProjection =
  | { status: 'PAYLOAD'; body: string; payloadHash: string }
  | { status: 'ERASED'; payloadHash: string; replay: 'REPLAY_SOURCE_PURGED' };

export function latestDispositionType(events: Array<{ eventType: string; createdAt: Date }>): string | null {
  if (!events.length) return null;
  return [...events].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.eventType.localeCompare(b.eventType)).at(-1)?.eventType ?? null;
}

export async function resolvePayload(db: StarDb, receiptId: string): Promise<PayloadProjection> {
  const [receipt] = await db.select().from(s.rawReceipts).where(eq(s.rawReceipts.id, receiptId));
  if (!receipt) return { status: 'MISSING', payloadHash: '' };
  const events = await db.select().from(s.rawDispositions).where(eq(s.rawDispositions.receiptId, receiptId));
  const executed = events.filter((e) => e.eventType === 'PURGE_EXECUTED');
  const [blob] = await db.select().from(s.rawBlobs).where(eq(s.rawBlobs.blobKey, receipt.payloadRef));
  if (executed.length) {
    const license = executed.some((e) => e.scope === 'LICENSE_ERASURE');
    return {
      status: 'PURGED',
      payloadHash: receipt.payloadHash,
      replay: license ? 'REPLAY_SOURCE_PURGED' : 'RAW_SOURCE_PURGED',
    };
  }
  if (!blob) return { status: 'MISSING', payloadHash: receipt.payloadHash };
  return { status: 'BYTES', body: blob.body, payloadHash: receipt.payloadHash };
}

export async function resolveFactPayload(db: StarDb, factId: string): Promise<FactPayloadProjection> {
  const [fact] = await db.select().from(s.normalizedFacts).where(eq(s.normalizedFacts.id, factId));
  if (!fact) return { status: 'ERASED', payloadHash: '', replay: 'REPLAY_SOURCE_PURGED' };
  const erasures = await db.select().from(s.factErasures).where(eq(s.factErasures.factId, factId));
  if (erasures.some((e) => e.disposition === 'LICENSE_ERASED')) {
    return { status: 'ERASED', payloadHash: fact.payloadHash, replay: 'REPLAY_SOURCE_PURGED' };
  }
  const [blob] = await db.select().from(s.rawBlobs).where(eq(s.rawBlobs.blobKey, fact.factPayloadRef));
  if (!blob) {
    return { status: 'ERASED', payloadHash: fact.payloadHash, replay: 'REPLAY_SOURCE_PURGED' };
  }
  return { status: 'PAYLOAD', body: blob.body, payloadHash: fact.payloadHash };
}

export class ReplayError extends Error {
  constructor(public readonly code: 'REPLAY_ARTIFACT_MISSING' | 'RAW_SOURCE_PURGED' | 'REPLAY_SOURCE_PURGED', message: string) {
    super(message);
    this.name = 'ReplayError';
  }
}

export async function requireArtifacts(db: StarDb, artifactIds: string[]): Promise<void> {
  for (const id of artifactIds) {
    const rows = await db.select().from(s.artifactRegistry).where(eq(s.artifactRegistry.id, id));
    if (!rows.length) throw new ReplayError('REPLAY_ARTIFACT_MISSING', `REPLAY_ARTIFACT_MISSING:${id}`);
  }
}
