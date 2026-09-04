/* eslint-disable @typescript-eslint/no-explicit-any -- test fixtures shim only the fields projectIneligibleFacts reads */
/**
 * STALE semantics (P0-2 closure): evaluation_at-driven staleness.
 * Invariants: no Date.now() in evaluation path; precedence deterministic;
 * boundary instant NOT stale (strictly-greater); future observed ⇒ not stale
 * (temporal kernel quarantines separately); per-kind SLA; policy versioned.
 */
import { describe, it, expect } from 'vitest';
import {
  isStale,
  projectIneligibleFacts,
  STALENESS_POLICY_V1,
  REASON_PRECEDENCE,
  type StalenessPolicy,
} from './eligibility';

const fact = (over: Record<string, unknown> = {}) => ({
  id: 'f1', receiptId: 'rc1', factKind: 'liquidity', subjectType: 'project',
  subjectId: 'proj-neural', payloadHash: 'h1', factPayloadRef: 'fb1',
  parserVersion: 'v1', factLocalKey: 'singleton', effectiveTimeKind: 'OBSERVATION_BOUND',
  createdAt: '2026-09-01T00:00:00Z',
  ...over,
});

describe('isStale (evaluation_at driven)', () => {
  it('liquidity 24h SLA: exactly max age => NOT stale; strictly older => stale', () => {
    const observed = '2026-09-01T00:00:00Z';
    expect(isStale({ observedAt: observed, evaluationAt: '2026-09-02T00:00:00Z', factKind: 'liquidity', policy: STALENESS_POLICY_V1 })).toBe(false);
    expect(isStale({ observedAt: observed, evaluationAt: '2026-09-02T00:00:00.001Z', factKind: 'liquidity', policy: STALENESS_POLICY_V1 })).toBe(true);
  });

  it('per-kind SLA: mint-authority tolerated 7d', () => {
    expect(isStale({ observedAt: '2026-09-01T00:00:00Z', evaluationAt: '2026-09-06T00:00:00Z', factKind: 'mint-authority', policy: STALENESS_POLICY_V1 })).toBe(false);
    expect(isStale({ observedAt: '2026-09-01T00:00:00Z', evaluationAt: '2026-09-08T00:00:00.001Z', factKind: 'mint-authority', policy: STALENESS_POLICY_V1 })).toBe(true);
  });

  it('future observed timestamps are NOT stale here (kernel quarantine owns them)', () => {
    expect(isStale({ observedAt: '2027-01-01T00:00:00Z', evaluationAt: '2026-09-02T00:00:00Z', factKind: 'liquidity', policy: STALENESS_POLICY_V1 })).toBe(false);
  });

  it('historical replay stability: same evaluation_at always same verdict regardless of wall clock', () => {
    // 30-day-old liquidity judged at a FIXED historical instant is stale — and
    // remains stale whether the test runs today or next year, because the
    // comparison never consults the current time.
    const v1 = isStale({ observedAt: '2026-08-01T00:00:00Z', evaluationAt: '2026-09-01T00:00:00Z', factKind: 'liquidity', policy: STALENESS_POLICY_V1 });
    expect(v1).toBe(true);
  });

  it('policy is versioned: shorter max_age flips verdict under v2', () => {
    const v2: StalenessPolicy = { ...STALENESS_POLICY_V1, policy_version: 'eligibility-stale@2', max_age_ms: { liquidity: 3600_000 } };
    expect(isStale({ observedAt: '2026-09-01T00:00:00Z', evaluationAt: '2026-09-01T02:00:00Z', factKind: 'liquidity', policy: v2 })).toBe(true);
    expect(isStale({ observedAt: '2026-09-01T00:00:00Z', evaluationAt: '2026-09-01T02:00:00Z', factKind: 'liquidity', policy: STALENESS_POLICY_V1 })).toBe(false);
  });
});

describe('reason precedence (deterministic single answer)', () => {
  const empty = { receiptRelations: [] as any[], contestResolutions: [] as any[], factRelations: [] as any[], factResolutions: [] as any[], erasures: [] as any[], dispositions: [] as any[] };

  it('CONTESTED beats STALE (no drift between concurrent reasons)', () => {
    const staleArg = { evaluationAt: '2026-10-01T00:00:00Z', policy: STALENESS_POLICY_V1 }; // 30d later
    const rel = { id: 'rr1', receiptId: 'rc1', relatedReceiptId: 'rc2', relation: 'CONTESTS' };
    const rc2Fact = fact({ id: 'f2', receiptId: 'rc2', payloadHash: 'h2' });
    const out = projectIneligibleFacts({ ...empty, facts: [fact(), rc2Fact] as any[], receiptRelations: [rel] as any[], stale: staleArg });
    const f1 = out.find((x) => x.factId === 'f1')!;
    expect(f1.reason).toBe('CONTESTED'); // both apply; contested wins
  });

  it('ERASED beats STALE', () => {
    const out = projectIneligibleFacts({
      ...empty,
      facts: [fact()] as any[],
      erasures: [{ factId: 'f1', disposition: 'LICENSE_ERASED' }] as any[],
      stale: { evaluationAt: '2026-10-01T00:00:00Z', policy: STALENESS_POLICY_V1 },
    });
    expect(out[0].reason).toBe('ERASED');
  });

  it('precedence order is frozen as specified', () => {
    expect(REASON_PRECEDENCE).toEqual(['REPLAY_SOURCE_PURGED', 'ERASED', 'CONTRADICTED', 'CONTESTED', 'STALE']);
  });

  it('no stale evaluation passed => no STALE marks (backward compatible)', () => {
    const out = projectIneligibleFacts({ ...empty, facts: [fact()] as any[] });
    expect(out).toHaveLength(0);
  });
});
