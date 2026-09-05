/**
 * The ONLY write path into the B1 Narrative Event Log. Append-only +
 * idempotent (unique natural keys, ON CONFLICT DO NOTHING). Rows carry a
 * SHA-256 payload hash for provenance. UPDATE/DELETE do not exist here in
 * any form and are additionally rejected by DB triggers (init-b1.sql).
 */
import { and, eq } from 'drizzle-orm';
import * as s from '@/db/schema';
import type { StarDb } from '@/lib/db';
import { newLedgerId, sha256hex } from '@/lib/data/hash';
import {
  assertAnchorBasis,
  assertAnchorKind,
  assertAttributionBasis,
  assertIsoUtc,
  assertRelation,
} from './contract';

export interface WriteResult {
  id: string;
  created: boolean;
}

async function hashOf(payload: Record<string, unknown>): Promise<string> {
  return sha256hex(JSON.stringify(payload));
}

export interface RecordEventInput {
  eventKey: string;
  label: string;
  attention?: number | null;
  observedAt: string;
  sourceId: string;
  payload: Record<string, unknown>;
}

export async function recordEvent(db: StarDb, input: RecordEventInput): Promise<WriteResult> {
  assertIsoUtc(input.observedAt, 'observedAt');
  const payloadHash = await hashOf(input.payload);
  const inserted = await db
    .insert(s.b1Events)
    .values({
      id: newLedgerId('b1evt'),
      eventKey: input.eventKey,
      label: input.label,
      attention: input.attention ?? null,
      observedAt: new Date(input.observedAt),
      ingestedAt: new Date(),
      sourceId: input.sourceId,
      payloadHash,
      payload: input.payload,
    })
    .onConflictDoNothing()
    .returning({ id: s.b1Events.id });
  if (inserted.length) return { id: inserted[0].id, created: true };
  const [row] = await db.select().from(s.b1Events).where(eq(s.b1Events.eventKey, input.eventKey));
  return { id: row.id, created: false };
}

export interface RecordNarrativeInput {
  narrativeKey: string;
  label: string;
  aliases?: string[];
  observedAt: string;
  sourceId: string;
  payload: Record<string, unknown>;
}

export async function recordNarrative(db: StarDb, input: RecordNarrativeInput): Promise<WriteResult> {
  assertIsoUtc(input.observedAt, 'observedAt');
  const payloadHash = await hashOf(input.payload);
  const inserted = await db
    .insert(s.b1Narratives)
    .values({
      id: newLedgerId('b1nar'),
      narrativeKey: input.narrativeKey,
      label: input.label,
      aliases: input.aliases ?? [],
      observedAt: new Date(input.observedAt),
      ingestedAt: new Date(),
      sourceId: input.sourceId,
      payloadHash,
      payload: input.payload,
    })
    .onConflictDoNothing()
    .returning({ id: s.b1Narratives.id });
  if (inserted.length) return { id: inserted[0].id, created: true };
  const [row] = await db.select().from(s.b1Narratives).where(eq(s.b1Narratives.narrativeKey, input.narrativeKey));
  return { id: row.id, created: false };
}

export interface RecordLinkInput {
  eventKey: string;
  narrativeKey: string;
  relation: string;
  observedAt: string;
  sourceId: string;
  payload: Record<string, unknown>;
}

/**
 * One-way Event → Narrative edge. Referential discipline: both endpoints must
 * already be recorded. There is no reverse API and no asset→narrative path
 * here — asset attribution has its own writer below (Narrative→Asset).
 */
export async function recordEventNarrativeLink(db: StarDb, input: RecordLinkInput): Promise<WriteResult> {
  assertRelation(input.relation);
  assertIsoUtc(input.observedAt, 'observedAt');
  const [event] = await db.select().from(s.b1Events).where(eq(s.b1Events.eventKey, input.eventKey));
  if (!event) throw new Error(`B1 referential: event '${input.eventKey}' not recorded (record events first)`);
  const [narrative] = await db.select().from(s.b1Narratives).where(eq(s.b1Narratives.narrativeKey, input.narrativeKey));
  if (!narrative) throw new Error(`B1 referential: narrative '${input.narrativeKey}' not recorded`);

  const payloadHash = await hashOf(input.payload);
  const inserted = await db
    .insert(s.b1EventNarrativeLinks)
    .values({
      id: newLedgerId('b1lnk'),
      eventKey: input.eventKey,
      narrativeKey: input.narrativeKey,
      relation: input.relation,
      observedAt: new Date(input.observedAt),
      ingestedAt: new Date(),
      sourceId: input.sourceId,
      payloadHash,
      payload: input.payload,
    })
    .onConflictDoNothing()
    .returning({ id: s.b1EventNarrativeLinks.id });
  if (inserted.length) return { id: inserted[0].id, created: true };
  const [row] = await db
    .select()
    .from(s.b1EventNarrativeLinks)
    .where(
      and(
        eq(s.b1EventNarrativeLinks.eventKey, input.eventKey),
        eq(s.b1EventNarrativeLinks.narrativeKey, input.narrativeKey),
        eq(s.b1EventNarrativeLinks.relation, input.relation),
      ),
    );
  return { id: row.id, created: false };
}

export interface RecordAssetInput {
  narrativeKey: string;
  assetId: string;
  universe: string;
  venue: string;
  attributionBasis: string;
  observedAt: string;
  sourceId: string;
  payload: Record<string, unknown>;
}

/** Attribute an asset INTO a narrative (cluster membership). Direction is fixed by parameter shape. */
export async function recordNarrativeAsset(db: StarDb, input: RecordAssetInput): Promise<WriteResult> {
  assertAttributionBasis(input.attributionBasis);
  assertIsoUtc(input.observedAt, 'observedAt');
  const [narrative] = await db.select().from(s.b1Narratives).where(eq(s.b1Narratives.narrativeKey, input.narrativeKey));
  if (!narrative) throw new Error(`B1 referential: narrative '${input.narrativeKey}' not recorded`);

  const payloadHash = await hashOf(input.payload);
  const inserted = await db
    .insert(s.b1NarrativeAssets)
    .values({
      id: newLedgerId('b1ast'),
      narrativeKey: input.narrativeKey,
      assetId: input.assetId,
      universe: input.universe,
      venue: input.venue,
      attributionBasis: input.attributionBasis,
      observedAt: new Date(input.observedAt),
      ingestedAt: new Date(),
      sourceId: input.sourceId,
      payloadHash,
      payload: input.payload,
    })
    .onConflictDoNothing()
    .returning({ id: s.b1NarrativeAssets.id });
  if (inserted.length) return { id: inserted[0].id, created: true };
  const [row] = await db
    .select()
    .from(s.b1NarrativeAssets)
    .where(and(eq(s.b1NarrativeAssets.narrativeKey, input.narrativeKey), eq(s.b1NarrativeAssets.assetId, input.assetId)));
  return { id: row.id, created: false };
}

export interface RecordAnchorInput {
  narrativeKey: string;
  anchor: string;
  anchoredAt: string;
  basis: string;
  sourceId: string;
  observedAt: string;
  payload: Record<string, unknown>;
}

/**
 * §14 time anchor. Append-only fact: once recorded it is never recomputed or
 * backfilled by inference (model §5 hard rule). Provenance rides in payload.
 */
export async function recordAnchor(db: StarDb, input: RecordAnchorInput): Promise<WriteResult> {
  assertAnchorKind(input.anchor);
  assertAnchorBasis(input.basis);
  assertIsoUtc(input.anchoredAt, 'anchoredAt');
  assertIsoUtc(input.observedAt, 'observedAt');
  const [narrative] = await db.select().from(s.b1Narratives).where(eq(s.b1Narratives.narrativeKey, input.narrativeKey));
  if (!narrative) throw new Error(`B1 referential: narrative '${input.narrativeKey}' not recorded`);

  const payloadHash = await hashOf(input.payload);
  const inserted = await db
    .insert(s.b1Anchors)
    .values({
      id: newLedgerId('b1anc'),
      narrativeKey: input.narrativeKey,
      anchor: input.anchor,
      anchoredAt: new Date(input.anchoredAt),
      basis: input.basis,
      sourceId: input.sourceId,
      observedAt: new Date(input.observedAt),
      ingestedAt: new Date(),
      payloadHash,
      payload: input.payload,
    })
    .onConflictDoNothing()
    .returning({ id: s.b1Anchors.id });
  if (inserted.length) return { id: inserted[0].id, created: true };
  const [row] = await db
    .select()
    .from(s.b1Anchors)
    .where(
      and(
        eq(s.b1Anchors.narrativeKey, input.narrativeKey),
        eq(s.b1Anchors.anchor, input.anchor),
        eq(s.b1Anchors.anchoredAt, new Date(input.anchoredAt)),
      ),
    );
  return { id: row.id, created: false };
}
