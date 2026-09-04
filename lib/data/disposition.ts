/**
 * Two-phase PURGE + HOLD. Blob delete is the only physical removal.
 * No tombstone bytes at the original payload_hash location.
 */
import { and, eq } from 'drizzle-orm';
import * as s from '@/db/schema';
import type { StarDb } from '@/lib/db';
import { newLedgerId } from './hash';
import { blobRefcount, recordRefcount } from './refcount';

export class DispositionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DispositionError';
  }
}

async function appendDisposition(
  db: StarDb,
  args: {
    receiptId: string;
    eventType: 'PURGE_REQUESTED' | 'PURGE_EXECUTED' | 'PURGE_CANCELLED' | 'QUARANTINE' | 'HOLD' | 'RELEASE';
    actor: string;
    reason: string;
    authorizationRef: string;
    scope: 'RAW_ONLY' | 'LICENSE_ERASURE' | 'HOLD' | 'NONE';
    idempotencyKey: string;
  },
): Promise<string> {
  const id = newLedgerId('disp');
  await db.insert(s.rawDispositions).values({
    id,
    receiptId: args.receiptId,
    eventType: args.eventType,
    actor: args.actor,
    reason: args.reason,
    authorizationRef: args.authorizationRef,
    scope: args.scope,
    idempotencyKey: args.idempotencyKey,
    createdAt: new Date(),
  });
  return id;
}

function hasOpenHold(events: Array<{ eventType: string }>): boolean {
  let hold = 0;
  for (const e of events) {
    if (e.eventType === 'HOLD') hold += 1;
    if (e.eventType === 'RELEASE' && hold > 0) hold -= 1;
  }
  return hold > 0;
}

export async function requestPurge(
  db: StarDb,
  args: {
    receiptId: string;
    actor: string;
    reason: string;
    authorizationRef: string;
    scope: 'RAW_ONLY' | 'LICENSE_ERASURE';
    idempotencyKey: string;
  },
): Promise<string> {
  const existing = await db.select().from(s.rawDispositions).where(
    and(eq(s.rawDispositions.receiptId, args.receiptId), eq(s.rawDispositions.idempotencyKey, args.idempotencyKey), eq(s.rawDispositions.eventType, 'PURGE_REQUESTED')),
  );
  if (existing.length) return existing[0].id;
  return appendDisposition(db, { ...args, eventType: 'PURGE_REQUESTED' });
}

export async function placeHold(
  db: StarDb,
  args: { receiptId: string; actor: string; reason: string; authorizationRef: string; idempotencyKey: string },
): Promise<string> {
  return appendDisposition(db, { ...args, eventType: 'HOLD', scope: 'HOLD' });
}

export async function releaseHold(
  db: StarDb,
  args: { receiptId: string; actor: string; reason: string; authorizationRef: string; idempotencyKey: string },
): Promise<string> {
  return appendDisposition(db, { ...args, eventType: 'RELEASE', scope: 'HOLD' });
}

export async function executePurge(
  db: StarDb,
  args: {
    receiptId: string;
    actor: string;
    reason: string;
    authorizationRef: string;
    scope: 'RAW_ONLY' | 'LICENSE_ERASURE';
    idempotencyKey: string;
  },
): Promise<{ cancelled: boolean; eventId: string }> {
  const events = await db.select().from(s.rawDispositions).where(eq(s.rawDispositions.receiptId, args.receiptId));
  if (hasOpenHold(events)) {
    const eventId = await appendDisposition(db, { ...args, eventType: 'PURGE_CANCELLED' });
    return { cancelled: true, eventId };
  }
  const [receipt] = await db.select().from(s.rawReceipts).where(eq(s.rawReceipts.id, args.receiptId));
  if (!receipt) throw new DispositionError(`unknown receipt ${args.receiptId}`);

  await recordRefcount(db, receipt.payloadRef, 'REMOVE', -1);
  if (await blobRefcount(db, receipt.payloadRef) <= 0) {
    await db.delete(s.rawBlobs).where(eq(s.rawBlobs.blobKey, receipt.payloadRef));
  }
  if (args.scope === 'LICENSE_ERASURE') {
    const facts = await db.select().from(s.normalizedFacts).where(eq(s.normalizedFacts.receiptId, args.receiptId));
    const allFacts = await db.select().from(s.normalizedFacts);
    const erasing = new Set(facts.map((f) => f.id));
    for (const fact of facts) {
      await db.insert(s.factErasures).values({
        id: newLedgerId('erase'),
        factId: fact.id,
        disposition: 'LICENSE_ERASED',
        scope: 'LICENSE_ERASURE',
        authorizationRef: args.authorizationRef,
        createdAt: new Date(),
      });
      await recordRefcount(db, fact.factPayloadRef, 'REMOVE', -1);
      const shared = allFacts.some((f) => f.factPayloadRef === fact.factPayloadRef && !erasing.has(f.id));
      if (!shared && (await blobRefcount(db, fact.factPayloadRef)) <= 0) {
        await db.delete(s.rawBlobs).where(eq(s.rawBlobs.blobKey, fact.factPayloadRef));
      }
    }
  }
  const eventId = await appendDisposition(db, { ...args, eventType: 'PURGE_EXECUTED' });
  return { cancelled: false, eventId };
}
