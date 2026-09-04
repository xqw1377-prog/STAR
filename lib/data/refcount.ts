import { eq } from 'drizzle-orm';
import * as s from '@/db/schema';
import type { StarDb } from '@/lib/db';
import { newLedgerId } from './hash';

export async function recordRefcount(
  db: StarDb,
  blobKey: string,
  eventType: 'ADD' | 'REMOVE' | 'RECONCILE',
  delta: number,
): Promise<void> {
  await db.insert(s.blobRefcounts).values({
    id: newLedgerId('ref'),
    blobKey,
    eventType,
    delta,
    createdAt: new Date(),
  });
}

export async function blobRefcount(db: StarDb, blobKey: string): Promise<number> {
  const rows = await db.select().from(s.blobRefcounts).where(eq(s.blobRefcounts.blobKey, blobKey));
  return rows.reduce((acc, r) => acc + r.delta, 0);
}
