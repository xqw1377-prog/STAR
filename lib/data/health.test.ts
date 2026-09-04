import { describe, beforeAll, it, expect } from 'vitest';
import { mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

process.env.PGLITE_DATA_DIR = mkdtempSync(join(tmpdir(), 'star-health-'));

let db: import('@/lib/db').StarDb;
let evaluateProjectAsOf: typeof import('@/lib/engine').evaluateProjectAsOf;
let startAttempt: typeof import('./ledger').startAttempt;
let completeFailure: typeof import('./ledger').completeFailure;
let ensurePlanItem: typeof import('./ledger').ensurePlanItem;
let projectHealthFromRows: typeof import('./health').projectHealthFromRows;
let loadHealthRows: typeof import('./health').loadHealthRows;
let TERMINAL_OUTCOMES: typeof import('./health').TERMINAL_OUTCOMES;

beforeAll(async () => {
  const { getDb } = await import('@/db/client');
  db = await getDb();
  const { seedDatabase } = await import('@/db/seed');
  await seedDatabase(db);
  ({ evaluateProjectAsOf } = await import('@/lib/engine'));
  const ledger = await import('./ledger');
  startAttempt = ledger.startAttempt;
  completeFailure = ledger.completeFailure;
  ensurePlanItem = ledger.ensurePlanItem;
  const health = await import('./health');
  projectHealthFromRows = health.projectHealthFromRows;
  loadHealthRows = health.loadHealthRows;
  TERMINAL_OUTCOMES = health.TERMINAL_OUTCOMES;
});

function rateSum(slice: { success_rate: number | null; partial_rate: number | null; source_error_rate: number | null; transport_error_rate: number | null; timeout_rate: number | null; aborted_rate: number | null }) {
  return (slice.success_rate ?? 0)
    + (slice.partial_rate ?? 0)
    + (slice.source_error_rate ?? 0)
    + (slice.transport_error_rate ?? 0)
    + (slice.timeout_rate ?? 0)
    + (slice.aborted_rate ?? 0);
}

describe('D1-D health projection', () => {
  it('T22: zero terminal attempts ⇒ six rates are null, not 0%', () => {
    const now = new Date('2026-09-04T12:00:00Z');
    const slice = projectHealthFromRows([], [], [], [], now);
    expect(slice.overall.success_rate).toBeNull();
    expect(slice.overall.partial_rate).toBeNull();
    expect(slice.overall.source_error_rate).toBeNull();
    expect(slice.overall.transport_error_rate).toBeNull();
    expect(slice.overall.timeout_rate).toBeNull();
    expect(slice.overall.aborted_rate).toBeNull();
    expect(slice.overall.response_availability).toBeNull();
    expect(slice.overall.unresolved_rate).toBeNull();
    expect(slice.overall.degraded_reason).toEqual(['NO_SAMPLE']);
  });

  it('R5-T13: no plan ⇒ completeness null; plan with zero facts ⇒ 0', () => {
    const now = new Date();
    const empty = projectHealthFromRows([], [], [], [], now);
    expect(empty.overall.completeness).toBeNull();
    const plans = [{
      id: 'plan-x',
      sourceId: 's',
      methodId: 'liquidity',
      subjectProject: 'p1',
      expectedFactKind: 'liquidity',
      planVersion: 'plan@1',
      observationTemplate: 'liquidity',
      createdAt: now,
      retiredAt: null,
    }];
    const zero = projectHealthFromRows([], [], plans, [], now);
    expect(zero.overall.completeness).toBe(0);
  });

  it('R5-T03: six terminal rates sum to 1; availability is orthogonal', async () => {
    const now = new Date();
    const planId = await ensurePlanItem(db, {
      sourceId: 'health-src',
      methodId: 'liquidity',
      projectId: 'proj-neural',
      factKind: 'liquidity',
    });
    const kinds: Array<{ msg: string }> = [
      { msg: 'timeout' },
      { msg: 'fetch failed' },
      { msg: 'HTTP 502 from upstream' },
      { msg: 'aborted by client' },
    ];
    for (const k of kinds) {
      const started = await startAttempt(db, {
        projectId: 'proj-neural',
        factKind: 'liquidity',
        sourceId: 'health-src',
        methodId: 'liquidity',
        planItemId: planId,
        startedAt: now,
      });
      await completeFailure(db, { attemptId: started.attemptId, error: new Error(k.msg) });
    }
    const rows = await loadHealthRows(db);
    const slice = projectHealthFromRows(rows.attempts, rows.outcomes, rows.plans, rows.facts, new Date(now.getTime() + 1000));
    const windowed = slice.source.find((s) => s.source_id === 'health-src');
    expect(windowed).toBeTruthy();
    expect(windowed!.terminal_n).toBeGreaterThanOrEqual(4);
    expect(rateSum(windowed!)).toBeCloseTo(1, 8);
    expect(windowed!.response_availability).not.toBeNull();
    expect(TERMINAL_OUTCOMES).toHaveLength(6);
  });

  it('T12: injecting health outcomes does not change gate status', async () => {
    const asOf = new Date('2026-08-25T12:00:00Z');
    const before = await evaluateProjectAsOf(db, 'proj-neural', asOf);
    const planId = await ensurePlanItem(db, {
      sourceId: 'health-src',
      methodId: 'liquidity',
      projectId: 'proj-neural',
      factKind: 'liquidity',
    });
    const started = await startAttempt(db, {
      projectId: 'proj-neural',
      factKind: 'liquidity',
      sourceId: 'health-src',
      methodId: 'liquidity',
      planItemId: planId,
    });
    await completeFailure(db, { attemptId: started.attemptId, error: new Error('timeout') });
    const after = await evaluateProjectAsOf(db, 'proj-neural', asOf);
    expect(after.gates.map((g) => `${g.gate}:${g.status}`)).toEqual(before.gates.map((g) => `${g.gate}:${g.status}`));
    expect(after.readiness).toBe(before.readiness);
  });

  it('T28: failed attempt with plan_item still counts in ProjectHealth', async () => {
    const now = new Date();
    const planId = await ensurePlanItem(db, {
      sourceId: 'health-src',
      methodId: 'sell-simulation',
      projectId: 'proj-honeypot',
      factKind: 'sell-simulation',
    });
    const started = await startAttempt(db, {
      projectId: 'proj-honeypot',
      factKind: 'sell-simulation',
      sourceId: 'health-src',
      methodId: 'sell-simulation',
      planItemId: planId,
      startedAt: now,
    });
    await completeFailure(db, { attemptId: started.attemptId, error: new Error('timeout') });
    const rows = await loadHealthRows(db);
    const slice = projectHealthFromRows(rows.attempts, rows.outcomes, rows.plans, rows.facts, new Date(now.getTime() + 1000));
    const proj = slice.project.find((p) => p.project_id === 'proj-honeypot' && p.fact_kind === 'sell-simulation');
    expect(proj).toBeTruthy();
    expect(proj!.terminal_n).toBeGreaterThan(0);
    expect(proj!.timeout_rate).toBeGreaterThan(0);
  });

  it('QA-01: BACKFILLED_UNKNOWN attempts stay out of live six rates', () => {
    const now = new Date('2026-09-04T12:00:00Z');
    const when = new Date('2026-09-04T11:30:00Z');
    const attempt = {
      id: 'att-bf-1',
      observationKey: 'obs-bf',
      collectionPlanItemId: null,
      projectId: 'proj-neural',
      factKind: 'liquidity',
      sourceId: 'fixture',
      methodId: 'backfill',
      attemptOrigin: 'INITIAL',
      startedAt: when,
      leaseExpiresAt: new Date(when.getTime() + 60_000),
      retryOfAttemptId: null,
      requestParamsSanitized: '{}',
      timingQuality: 'BACKFILLED_UNKNOWN',
    };
    const outcome = {
      id: 'out-bf-1',
      attemptId: 'att-bf-1',
      outcome: 'SUCCESS' as const,
      responseBytesReceived: 1,
      completedAt: when,
      errorCode: null,
      errorBodyHash: null,
      errorBodyRef: null,
      retentionClass: 'NONE',
    };
    const liveAttempt = {
      ...attempt,
      id: 'att-live-1',
      observationKey: 'obs-live',
      methodId: 'live',
      timingQuality: 'LIVE',
    };
    const liveOutcome = {
      ...outcome,
      id: 'out-live-1',
      attemptId: 'att-live-1',
      outcome: 'TIMEOUT' as const,
      responseBytesReceived: 0,
    };
    const backfillOnly = projectHealthFromRows([attempt], [outcome], [], [], now);
    expect(backfillOnly.backfill_n).toBe(1);
    expect(backfillOnly.overall.terminal_n).toBe(0);
    expect(backfillOnly.overall.success_rate).toBeNull();
    expect(backfillOnly.overall.degraded_reason).toEqual(['BACKFILL_ONLY']);

    const mixed = projectHealthFromRows([attempt, liveAttempt], [outcome, liveOutcome], [], [], now);
    expect(mixed.backfill_n).toBe(1);
    expect(mixed.overall.terminal_n).toBe(1);
    expect(mixed.overall.success_rate).toBe(0);
    expect(mixed.overall.timeout_rate).toBe(1);
  });

  it('T13: health module does not import gate/score paths', () => {
    const src = readFileSync(join(__dirname, 'health.ts'), 'utf8');
    expect(src).not.toMatch(/interpretCheck|aggregateGates|scoringAllowed|THRESHOLDS|decisionReadiness/);
    expect(src).not.toMatch(/from ['"]@\/lib\/engine/);
    expect(src).not.toMatch(/from ['"]@\/lib\/domain/);
  });
});
