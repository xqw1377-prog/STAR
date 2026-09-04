import { describe, beforeAll, it, expect } from 'vitest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { eq } from 'drizzle-orm';

process.env.PGLITE_DATA_DIR = mkdtempSync(join(tmpdir(), 'star-elig-'));

let db: import('@/lib/db').StarDb;
let schema: typeof import('@/db/schema');
let startAttempt: typeof import('./ledger').startAttempt;
let completeSuccess: typeof import('./ledger').completeSuccess;
let completeFailure: typeof import('./ledger').completeFailure;
let linkReceipts: typeof import('./relations').linkReceipts;
let resolveContest: typeof import('./relations').resolveContest;
let contradictFacts: typeof import('./relations').contradictFacts;
let resolveFactConflict: typeof import('./relations').resolveFactConflict;
let registerArtifact: typeof import('./relations').registerArtifact;
let loadIneligibleFacts: typeof import('./eligibility').loadIneligibleFacts;
let evaluateFactsAsOf: typeof import('@/lib/engine').evaluateFactsAsOf;
let evaluateProjectAsOf: typeof import('@/lib/engine').evaluateProjectAsOf;
let requireArtifacts: typeof import('./resolve').requireArtifacts;
let ReplayError: typeof import('./resolve').ReplayError;

beforeAll(async () => {
  const { getDb } = await import('@/db/client');
  db = await getDb();
  const { seedDatabase } = await import('@/db/seed');
  await seedDatabase(db);
  schema = await import('@/db/schema');
  const ledger = await import('./ledger');
  startAttempt = ledger.startAttempt;
  completeSuccess = ledger.completeSuccess;
  completeFailure = ledger.completeFailure;
  const rel = await import('./relations');
  linkReceipts = rel.linkReceipts;
  resolveContest = rel.resolveContest;
  contradictFacts = rel.contradictFacts;
  resolveFactConflict = rel.resolveFactConflict;
  registerArtifact = rel.registerArtifact;
  ({ loadIneligibleFacts } = await import('./eligibility'));
  const engine = await import('@/lib/engine');
  evaluateFactsAsOf = engine.evaluateFactsAsOf;
  evaluateProjectAsOf = engine.evaluateProjectAsOf;
  ({ requireArtifacts, ReplayError } = await import('./resolve'));
});

function fact(payload: Record<string, unknown>, observedAt = '2026-09-04T00:00:00Z') {
  return {
    kind: 'liquidity' as const,
    contractVersion: 'solana-readonly@3',
    observedAt,
    slot: 99,
    source: 'elig-src',
    sourceUrl: null,
    chainId: 'solana' as const,
    mint: '11111111111111111111111111111111',
    payload: { tvlUsdTotal: 400000, exitDepthUsd: 80000, pools: [], ...payload },
  };
}

async function writeOne(payload: Record<string, unknown>, observationKey: string) {
  const started = await startAttempt(db, {
    projectId: 'proj-neural',
    factKind: 'liquidity',
    sourceId: 'elig-src',
    methodId: 'liquidity',
    observationKey,
  });
  return completeSuccess(db, {
    attemptId: started.attemptId,
    observationKey: started.observationKey,
    projectId: 'proj-neural',
    fact: fact(payload),
    writeEvidence: true,
  });
}

describe('D1-B eligibility and lineage', () => {
  it('T03b: evidence.hash traces to receipt.payload_hash via fact', async () => {
    const { receiptId } = await writeOne({ tvlUsdTotal: 777000 }, 'obs-trace');
    const [receipt] = await db.select().from(schema.rawReceipts).where(eq(schema.rawReceipts.id, receiptId));
    const facts = await db.select().from(schema.normalizedFacts).where(eq(schema.normalizedFacts.receiptId, receiptId));
    const evidence = (await db.select().from(schema.evidence)).filter((e) => e.hash === receipt.payloadHash);
    expect(facts[0].payloadHash).toBe(receipt.payloadHash);
    expect(evidence.length).toBeGreaterThan(0);
    expect(evidence[0].type).toBe('liquidity');
  });

  it('R5-T09: unresolved CONTESTS facts are not gate-eligible; resolution restores only the winner', async () => {
    const a = await writeOne({ tvlUsdTotal: 111000 }, 'obs-contest-a');
    const b = await writeOne({ tvlUsdTotal: 222000 }, 'obs-contest-b');
    const relId = await linkReceipts(db, {
      receiptId: a.receiptId,
      relatedReceiptId: b.receiptId,
      relation: 'CONTESTS',
      basis: 'manual',
      creatorRef: 'test',
    });
    const blocked = await loadIneligibleFacts(db);
    expect(blocked.some((f) => f.receiptId === a.receiptId && f.reason === 'CONTESTED')).toBe(true);
    expect(blocked.some((f) => f.receiptId === b.receiptId && f.reason === 'CONTESTED')).toBe(true);

    await resolveContest(db, {
      relationId: relId,
      resolvedReceiptId: a.receiptId,
      basis: 'MANUAL_AUDIT',
      basisVersion: 'policy-v1',
      authorizationRef: 'audit-1',
    });
    const after = await loadIneligibleFacts(db);
    expect(after.some((f) => f.receiptId === a.receiptId && f.reason === 'CONTESTED')).toBe(false);
    expect(after.some((f) => f.receiptId === b.receiptId && f.reason === 'CONTESTED')).toBe(true);
  });

  it('T26: CONTRADICTS facts stay UNKNOWN until fact_resolution_event', async () => {
    const a = await writeOne({ tvlUsdTotal: 301000 }, 'obs-contra-a');
    const b = await writeOne({ tvlUsdTotal: 302000 }, 'obs-contra-b');
    const [fa] = await db.select().from(schema.normalizedFacts).where(eq(schema.normalizedFacts.receiptId, a.receiptId));
    const [fb] = await db.select().from(schema.normalizedFacts).where(eq(schema.normalizedFacts.receiptId, b.receiptId));
    const rel = await contradictFacts(db, fa.id, fb.id);
    const blocked = await loadIneligibleFacts(db);
    expect(blocked.some((f) => f.factId === fa.id && f.reason === 'CONTRADICTED')).toBe(true);
    await resolveFactConflict(db, {
      factRelationId: rel,
      resolvedFactId: fa.id,
      basis: 'SOURCE_PRIORITY',
      basisVersion: 'sha-priority-1',
      authorizationRef: 'pol-1',
    });
    const after = await loadIneligibleFacts(db);
    expect(after.some((f) => f.factId === fa.id && f.reason === 'CONTRADICTED')).toBe(false);
    expect(after.some((f) => f.factId === fb.id && f.reason === 'CONTRADICTED')).toBe(true);
  });

  it('R5-T12a: ineligible evidence is dropped; gate UNKNOWN and score null', () => {
    const ev = evaluateFactsAsOf({
      projectId: 'proj-x',
      asOf: new Date('2026-09-04T00:00:00Z'),
      lifecycle: 'VERIFIED',
      discoveredAt: new Date('2026-01-01T00:00:00Z'),
      rows: [{
        id: 'e1',
        type: 'liquidity',
        observedAt: new Date('2026-09-01T00:00:00Z'),
        effectiveAt: new Date('2026-09-01T00:00:00Z'),
        ingestedAt: new Date('2026-09-01T01:00:00Z'),
        source: 'fixture',
        payload: { tvlUsdTotal: 400000, exitDepthUsd: 80000, pools: [{ tvlUsd: 400000, lpBurnedPct: 1 }] },
        conclusion: 'liq',
      }],
      ineligible: [{ id: 'e1', reason: 'CONTESTED' }],
    });
    expect(ev.gates.find((g) => g.gate === 'liquidity')?.status).toBe('UNKNOWN');
    expect(ev.score).toBeNull();
    expect(ev.readiness).toBe('RESEARCH_REQUIRED');
    expect(ev.ineligible[0].reason).toBe('CONTESTED');
  });

  it('T06b: timeout writes an outcome and leaves the gate without a fact', async () => {
    const started = await startAttempt(db, {
      projectId: 'proj-honeypot',
      factKind: 'sell-simulation',
      sourceId: 'elig-src',
      methodId: 'sell-simulation',
    });
    await completeFailure(db, { attemptId: started.attemptId, error: new Error('timeout') });
    const outcomes = await db.select().from(schema.attemptOutcomes).where(eq(schema.attemptOutcomes.attemptId, started.attemptId));
    expect(outcomes[0].outcome).toBe('TIMEOUT');
    const facts = await db.select().from(schema.normalizedFacts).where(eq(schema.normalizedFacts.receiptId, started.attemptId));
    expect(facts).toHaveLength(0);
    const ev = await evaluateProjectAsOf(db, 'proj-honeypot', new Date('2026-07-01T00:00:00Z'));
    expect(ev.gates.every((g) => g.status === 'UNKNOWN')).toBe(true);
    expect(ev.score).toBeNull();
  });

  it('R5-T11: HISTORICAL replay fails closed when an artifact is missing', async () => {
    const id = await registerArtifact(db, {
      kind: 'eligibility-policy',
      version: 'elig@test-missing',
      contentHash: 'abc',
      contentRef: 'blob:elig@test-missing',
    });
    await requireArtifacts(db, [id]);
    await expect(requireArtifacts(db, [id, 'missing-art'])).rejects.toBeInstanceOf(ReplayError);
    await expect(requireArtifacts(db, ['missing-art'])).rejects.toMatchObject({ code: 'REPLAY_ARTIFACT_MISSING' });
  });

  it('R5-T08: one receipt can carry CONTESTS + SUPERSEDES + DUPLICATES', async () => {
    const a = await writeOne({ tvlUsdTotal: 401000 }, 'obs-multi');
    const b = await writeOne({ tvlUsdTotal: 402000 }, 'obs-multi-b');
    await linkReceipts(db, { receiptId: a.receiptId, relatedReceiptId: b.receiptId, relation: 'CONTESTS', basis: 'x', creatorRef: 't' });
    await linkReceipts(db, { receiptId: a.receiptId, relatedReceiptId: b.receiptId, relation: 'SUPERSEDES', basis: 'x', creatorRef: 't' });
    await linkReceipts(db, { receiptId: a.receiptId, relatedReceiptId: b.receiptId, relation: 'DUPLICATES', basis: 'x', creatorRef: 't' });
    const rels = (await db.select().from(schema.receiptRelations)).filter((r) => r.receiptId === a.receiptId && r.relatedReceiptId === b.receiptId);
    expect(new Set(rels.map((r) => r.relation))).toEqual(new Set(['CONTESTS', 'SUPERSEDES', 'DUPLICATES']));
  });
});
