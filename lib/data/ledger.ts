/**
 * D1-A fact ledger. Two-phase: Start commits before the request runs;
 * exactly one Outcome follows. Receipt.payload_ref is a dangling handle
 * (no DB FK). Evidence rows remain a denormalized projection.
 */
import { eq } from 'drizzle-orm';
import * as s from '@/db/schema';
import type { StarDb } from '@/lib/db';
import type { ChainFact } from './contract';
import { ContractViolation } from './contract';
import { blobKeyFor, blobScope, newLedgerId, sha256hex } from './hash';
import { contestSiblings } from './relations';
import { recordRefcount } from './refcount';

export const PLAN_VERSION = 'plan@1';
export const PARSER_VERSION = 'parser@1';
export const LEASE_MS = 60_000;
export const RETENTION_RAW = 'RAW_RETAINED';

export type AttemptOrigin = 'INITIAL' | 'RETRY' | 'CRASH_REPLAY' | 'SCHEDULER_REISSUE';
export type TerminalOutcome =
  | 'SUCCESS'
  | 'PARTIAL'
  | 'SOURCE_ERROR'
  | 'TRANSPORT_ERROR'
  | 'TIMEOUT'
  | 'ABORTED';

const PARAM_DENY = /api[_-]?key|authorization|signature|password|secret|token|credential/i;

export function sanitizeRequestParams(params: Record<string, unknown>): string {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (PARAM_DENY.test(k)) continue;
    if (typeof v === 'string' && /https?:\/\/\S+:\S+@/i.test(v)) continue;
    out[k] = v;
  }
  return JSON.stringify(out);
}

export function classifyCollectError(e: unknown): {
  outcome: Exclude<TerminalOutcome, 'SUCCESS'>;
  responseBytes: boolean;
  errorCode: string;
  errorBody: string;
} {
  const msg = e instanceof Error ? e.message : String(e);
  const name = e instanceof Error ? e.name : '';
  const errorBody = msg.slice(0, 500);
  if (e instanceof ContractViolation) {
    return { outcome: 'PARTIAL', responseBytes: true, errorCode: 'CONTRACT', errorBody };
  }
  if (name === 'AbortError' || /\baborted\b/i.test(msg)) {
    return { outcome: 'ABORTED', responseBytes: false, errorCode: 'ABORTED', errorBody };
  }
  if (/\btimeout\b|etimedout/i.test(msg)) {
    return { outcome: 'TIMEOUT', responseBytes: false, errorCode: 'TIMEOUT', errorBody };
  }
  if (/fetch failed|econnrefused|enotfound|econnreset|network|tls|cert/i.test(msg)) {
    return { outcome: 'TRANSPORT_ERROR', responseBytes: false, errorCode: 'TRANSPORT', errorBody };
  }
  if (/http[/\s][45]|status\s*[45]\d\d/i.test(msg)) {
    return { outcome: 'SOURCE_ERROR', responseBytes: true, errorCode: 'HTTP', errorBody };
  }
  return { outcome: 'SOURCE_ERROR', responseBytes: false, errorCode: 'PROVIDER', errorBody };
}

export async function ensurePlanItem(
  db: StarDb,
  args: { sourceId: string; methodId: string; projectId: string; factKind: string; planVersion?: string },
): Promise<string> {
  const planVersion = args.planVersion ?? PLAN_VERSION;
  const id = `plan-${args.sourceId}-${args.methodId}-${args.projectId}-${args.factKind}-${planVersion}`
    .replace(/[^a-zA-Z0-9@._-]/g, '_');
  const existing = await db.select().from(s.collectionPlanItems).where(eq(s.collectionPlanItems.id, id));
  if (existing.length) return id;
  await db.insert(s.collectionPlanItems).values({
    id,
    sourceId: args.sourceId,
    methodId: args.methodId,
    subjectProject: args.projectId,
    expectedFactKind: args.factKind,
    planVersion,
    observationTemplate: `${args.methodId}:${args.factKind}`,
    createdAt: new Date(),
    retiredAt: null,
  });
  return id;
}

export async function startAttempt(
  db: StarDb,
  args: {
    projectId: string;
    factKind: string;
    sourceId: string;
    methodId: string;
    origin?: AttemptOrigin;
    planItemId?: string | null;
    observationKey?: string;
    requestParams?: Record<string, unknown>;
    startedAt?: Date;
    leaseMs?: number;
    retryOfAttemptId?: string | null;
    timingQuality?: 'LIVE' | 'BACKFILLED_UNKNOWN';
  },
): Promise<{ attemptId: string; observationKey: string; startedAt: Date; leaseExpiresAt: Date }> {
  const startedAt = args.startedAt ?? new Date();
  const leaseExpiresAt = new Date(startedAt.getTime() + (args.leaseMs ?? LEASE_MS));
  const observationKey = args.observationKey
    ?? `${args.sourceId}|${args.methodId}|${args.projectId}|${args.factKind}|${PLAN_VERSION}`;
  const attemptId = newLedgerId('att');
  await db.insert(s.collectionAttempts).values({
    id: attemptId,
    observationKey,
    collectionPlanItemId: args.planItemId ?? null,
    projectId: args.projectId,
    factKind: args.factKind,
    sourceId: args.sourceId,
    methodId: args.methodId,
    attemptOrigin: args.origin ?? 'INITIAL',
    startedAt,
    leaseExpiresAt,
    retryOfAttemptId: args.retryOfAttemptId ?? null,
    requestParamsSanitized: sanitizeRequestParams(args.requestParams ?? { projectId: args.projectId, factKind: args.factKind }),
    timingQuality: args.timingQuality ?? 'LIVE',
  });
  return { attemptId, observationKey, startedAt, leaseExpiresAt };
}

async function insertOutcome(
  db: StarDb,
  args: {
    attemptId: string;
    outcome: TerminalOutcome;
    responseBytes: boolean;
    completedAt?: Date;
    errorCode?: string | null;
    errorBody?: string | null;
  },
): Promise<string> {
  const id = newLedgerId('out');
  let errorBodyHash: string | null = null;
  let errorBodyRef: string | null = null;
  let retentionClass = 'NONE';
  if (args.errorBody && args.responseBytes) {
    errorBodyHash = await sha256hex(args.errorBody);
    const scope = blobScope('error', RETENTION_RAW);
    errorBodyRef = await blobKeyFor(scope, errorBodyHash);
    const existing = await db.select().from(s.rawBlobs).where(eq(s.rawBlobs.blobKey, errorBodyRef));
    if (!existing.length) {
      await db.insert(s.rawBlobs).values({
        blobKey: errorBodyRef,
        payloadHash: errorBodyHash,
        scope,
        body: args.errorBody,
        length: args.errorBody.length,
        mime: 'text/plain',
        createdAt: new Date(),
      });
    }
    await recordRefcount(db, errorBodyRef, 'ADD', 1);
    retentionClass = RETENTION_RAW;
  }
  await db.insert(s.attemptOutcomes).values({
    id,
    attemptId: args.attemptId,
    outcome: args.outcome,
    responseBytesReceived: args.responseBytes ? 1 : 0,
    completedAt: args.completedAt ?? new Date(),
    errorCode: args.errorCode ?? null,
    errorBodyHash,
    errorBodyRef,
    retentionClass,
  });
  return id;
}

async function upsertReceipt(
  db: StarDb,
  args: {
    observationKey: string;
    outcomeEventId: string;
    status: 'SUCCESS' | 'PARTIAL';
    payload: unknown;
    slot?: number | null;
    observedAt: Date;
  },
): Promise<{ receiptId: string; payloadHash: string; payloadRef: string; created: boolean }> {
  const body = JSON.stringify(args.payload);
  const payloadHash = await sha256hex(body);
  const receiptKey = await sha256hex(`${args.observationKey}|${payloadHash}`);
  const existing = await db.select().from(s.rawReceipts).where(eq(s.rawReceipts.receiptKey, receiptKey));
  const scope = blobScope('collect', RETENTION_RAW);
  const payloadRef = await blobKeyFor(scope, payloadHash);
  if (!existing.length) {
    const blob = await db.select().from(s.rawBlobs).where(eq(s.rawBlobs.blobKey, payloadRef));
    if (!blob.length) {
      await db.insert(s.rawBlobs).values({
        blobKey: payloadRef,
        payloadHash,
        scope,
        body,
        length: body.length,
        mime: 'application/json',
        createdAt: new Date(),
      });
    }
    await recordRefcount(db, payloadRef, 'ADD', 1);
    const receiptId = newLedgerId('rcpt');
    await db.insert(s.rawReceipts).values({
      id: receiptId,
      receiptKey,
      observationKey: args.observationKey,
      creatorOutcomeEventId: args.outcomeEventId,
      status: args.status,
      payloadHash,
      payloadRef,
      anchorSlot: args.slot ?? null,
      anchorTime: args.observedAt,
      createdAt: new Date(),
    });
    await contestSiblings(db, receiptId, args.observationKey, payloadHash, args.slot ?? null, args.observedAt);
    return { receiptId, payloadHash, payloadRef, created: true };
  }
  return { receiptId: existing[0].id, payloadHash, payloadRef: existing[0].payloadRef, created: false };
}

async function writeFact(
  db: StarDb,
  args: { receiptId: string; factKind: string; projectId: string; payloadHash: string; body: string },
): Promise<void> {
  const factScope = blobScope('fact', RETENTION_RAW);
  const factPayloadRef = await blobKeyFor(factScope, args.payloadHash);
  const existingBlob = await db.select().from(s.rawBlobs).where(eq(s.rawBlobs.blobKey, factPayloadRef));
  if (!existingBlob.length) {
    await db.insert(s.rawBlobs).values({
      blobKey: factPayloadRef,
      payloadHash: args.payloadHash,
      scope: factScope,
      body: args.body,
      length: args.body.length,
      mime: 'application/json',
      createdAt: new Date(),
    });
  }
  await recordRefcount(db, factPayloadRef, 'ADD', 1);
  const id = newLedgerId('fact');
  try {
    await db.insert(s.normalizedFacts).values({
      id,
      receiptId: args.receiptId,
      factKind: args.factKind,
      subjectType: 'project',
      subjectId: args.projectId,
      payloadHash: args.payloadHash,
      factPayloadRef,
      parserVersion: PARSER_VERSION,
      factLocalKey: 'singleton',
      effectiveTimeKind: 'OBSERVATION_BOUND',
      createdAt: new Date(),
    });
  } catch {
    // Unique (receipt, kind, subject, parser, local_key) — same receipt, no new fact.
  }
}

async function projectEvidence(
  db: StarDb,
  args: {
    projectId: string;
    factKind: string;
    observedAt: Date;
    source: string;
    sourceUrl: string;
    payloadHash: string;
    payload: unknown;
    conclusion: string;
  },
): Promise<void> {
  await db.insert(s.evidence).values({
    projectId: args.projectId,
    type: args.factKind,
    observedAt: args.observedAt,
    effectiveAt: args.observedAt,
    ingestedAt: new Date(),
    source: args.source,
    sourceUrl: args.sourceUrl,
    hash: args.payloadHash,
    payload: args.payload as Record<string, unknown>,
    conclusion: args.conclusion,
    conflictWith: null,
  });
}

export async function completeSuccess(
  db: StarDb,
  args: {
    attemptId: string;
    observationKey: string;
    projectId: string;
    fact: ChainFact;
    extraFacts?: Array<{ kind: string; payload: unknown; conclusion: string }>;
    writeEvidence?: boolean;
    completedAt?: Date;
  },
): Promise<{ outcomeId: string; receiptId: string }> {
  const observedAt = new Date(args.fact.observedAt);
  const outcomeId = await insertOutcome(db, {
    attemptId: args.attemptId,
    outcome: 'SUCCESS',
    responseBytes: true,
    completedAt: args.completedAt,
  });
  const receipt = await upsertReceipt(db, {
    observationKey: args.observationKey,
    outcomeEventId: outcomeId,
    status: 'SUCCESS',
    payload: args.fact.payload,
    slot: args.fact.slot,
    observedAt,
  });
  await db.insert(s.attemptReceiptLinks).values({
    id: newLedgerId('lnk'),
    outcomeEventId: outcomeId,
    receiptId: receipt.receiptId,
  });
  await writeFact(db, {
    receiptId: receipt.receiptId,
    factKind: args.fact.kind,
    projectId: args.projectId,
    payloadHash: receipt.payloadHash,
    body: JSON.stringify(args.fact.payload),
  });
  if (args.writeEvidence !== false) {
    await projectEvidence(db, {
      projectId: args.projectId,
      factKind: args.fact.kind,
      observedAt,
      source: args.fact.source,
      sourceUrl: args.fact.sourceUrl ?? '',
      payloadHash: receipt.payloadHash,
      payload: args.fact.payload,
      conclusion: `${args.fact.kind} @ slot ${args.fact.slot ?? 'n/a'} (${args.fact.source})`,
    });
  }
  for (const extra of args.extraFacts ?? []) {
    await writeFact(db, {
      receiptId: receipt.receiptId,
      factKind: extra.kind,
      projectId: args.projectId,
      payloadHash: receipt.payloadHash,
      body: JSON.stringify(extra.payload),
    });
    if (args.writeEvidence !== false) {
      await projectEvidence(db, {
        projectId: args.projectId,
        factKind: extra.kind,
        observedAt,
        source: args.fact.source,
        sourceUrl: args.fact.sourceUrl ?? '',
        payloadHash: await sha256hex(JSON.stringify(extra.payload)),
        payload: extra.payload,
        conclusion: extra.conclusion,
      });
    }
  }
  return { outcomeId, receiptId: receipt.receiptId };
}

export async function completeFailure(
  db: StarDb,
  args: { attemptId: string; error: unknown },
): Promise<string> {
  const classified = classifyCollectError(args.error);
  return insertOutcome(db, {
    attemptId: args.attemptId,
    outcome: classified.outcome,
    responseBytes: classified.responseBytes,
    errorCode: classified.errorCode,
    errorBody: classified.errorBody,
  });
}

/** Seed / fixture backfill: one SUCCESS chain from an already-written evidence row. */
export async function backfillSuccessFromEvidence(
  db: StarDb,
  args: {
    projectId: string;
    factKind: string;
    sourceId: string;
    payload: unknown;
    observedAt: Date;
    ingestedAt: Date;
    slot?: number | null;
  },
): Promise<void> {
  const planItemId = await ensurePlanItem(db, {
    sourceId: args.sourceId,
    methodId: args.factKind,
    projectId: args.projectId,
    factKind: args.factKind,
  });
  const started = await startAttempt(db, {
    projectId: args.projectId,
    factKind: args.factKind,
    sourceId: args.sourceId,
    methodId: args.factKind,
    planItemId,
    startedAt: args.ingestedAt,
    leaseMs: 1,
    timingQuality: 'BACKFILLED_UNKNOWN',
    requestParams: { projectId: args.projectId, factKind: args.factKind, origin: 'fixture-backfill' },
  });
  const fact = {
    kind: args.factKind as ChainFact['kind'],
    contractVersion: 'solana-readonly@3',
    observedAt: args.observedAt.toISOString(),
    slot: args.slot ?? null,
    source: args.sourceId,
    sourceUrl: null,
    chainId: 'solana',
    mint: '11111111111111111111111111111111',
    payload: args.payload as ChainFact['payload'],
  };
  await completeSuccess(db, {
    attemptId: started.attemptId,
    observationKey: started.observationKey,
    projectId: args.projectId,
    fact,
    writeEvidence: false,
    completedAt: args.ingestedAt,
  });
}
