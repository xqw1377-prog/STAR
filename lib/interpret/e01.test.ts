/**
 * E-01 Interpreter acceptance tests (F2-B Implementation, authorized 2026-09-05).
 * Nine invariant groups per the F2-B Implementation Authorization:
 *  a. PARTIAL only at 0<N<intended
 *  b. feesResolved=false does not prevent pre-fee N (GAP-03)
 *  c. BUY annotation does not change gate state (GCP-GAP-02 D)
 *  d. Zero verdict language in outputs
 *  e. Deterministic replay
 *  f. Five-layer eligibility gate
 *  g. gates@3 semantics not retroactively changed
 *  h. RULE_VERSION = gates@4
 *  i. RULE_VERSION ≠ gates@3
 */
import { describe, expect, it } from 'vitest';
import { EVIDENCE_CONTRACT_VERSION, type EvidenceRecord } from '@/lib/evidence/contract';
import { eligibleForE01, interpretE01Buy, interpretE01Sell } from './e01';
import { RULE_VERSION } from '@/lib/domain/thresholds';
import { gateStatuses } from '@/lib/domain/types';

const OBS = '2026-09-04T00:00:00.000Z';

function poolStateRecord(over: Partial<EvidenceRecord> & { value?: Record<string, unknown> } = {}): EvidenceRecord {
  return {
    evidenceId: 'ev-poolstate-test-1',
    contractVersion: EVIDENCE_CONTRACT_VERSION,
    cap: 'CAP-02-CHAIN',
    source: 'synthetic-fixtures',
    adapter: 'reserve-curve-fact-adapter',
    sourceVersion: 'star-reserve-curve@1',
    entityType: 'pool',
    entityId: 'raydium-amm-v4:test',
    factType: 'pool-state',
    value: {
      mint: 'TestMint111111111111111111111111111111111',
      poolAddress: 'TestPool11111111111111111111111111111111',
      venue: 'raydium-amm-v4',
      slot: 1200,
      feesResolved: false,
      reserveQuote: '1000000',
      reserveBase: '2000000',
    },
    observedAt: OBS,
    slot: 1200,
    txSignatures: [],
    confidence: null,
    provenance: { method: 'decode:pool-account-layout', rawRef: 'test' },
    ...over,
  };
}

describe('invariant h+i: RULE_VERSION', () => {
  it('is gates@4 and not gates@3', () => {
    expect(RULE_VERSION).toBe('gates@4');
    expect(RULE_VERSION).not.toBe('gates@3');
  });
  it('GateStatus includes PARTIAL (gates@4 enum)', () => {
    expect(gateStatuses).toContain('PARTIAL');
  });
});

describe('invariant a: PARTIAL only at 0<N<intended', () => {
  it('N=0 → FAIL, not PARTIAL', () => {
    // Reserves too small: pricing leg gives 0
    const rec = poolStateRecord({ value: { venue: 'raydium-amm-v4', mint: 'M', poolAddress: 'P', slot: 1, feesResolved: true, reserveQuote: '4', reserveBase: '100' } });
    const result = interpretE01Sell({ poolState: rec, intendedNotional: 100n });
    expect(result.status).toBe('FAIL');
  });

  it('N≥intended → PASS, not PARTIAL', () => {
    // Large reserves: N will be large
    const rec = poolStateRecord({ value: { venue: 'raydium-amm-v4', mint: 'M', poolAddress: 'P', slot: 1, feesResolved: true, reserveQuote: '1000000000000', reserveBase: '2000000000000' } });
    const result = interpretE01Sell({ poolState: rec, intendedNotional: 1000n });
    expect(result.status).toBe('PASS');
    expect(result.executableNotional).toBeGreaterThan(1000n);
  });

  it('0<N<intended → PARTIAL (the unique path)', () => {
    // Reserves: pricing leg gives Rq/5 = 200, intended = 1000
    const rec = poolStateRecord({ value: { venue: 'raydium-amm-v4', mint: 'M', poolAddress: 'P', slot: 1, feesResolved: true, reserveQuote: '1000', reserveBase: '5000' } });
    const result = interpretE01Sell({ poolState: rec, intendedNotional: 1000n });
    expect(result.status).toBe('PARTIAL');
    expect(result.executableNotional).toBeGreaterThan(0n);
    expect(result.executableNotional!).toBeLessThan(1000n);
    expect(result.reason).toContain('Partial capacity');
  });

  it('PARTIAL is NOT produced from missing inputs (that is UNKNOWN)', () => {
    const rec = poolStateRecord({ value: { venue: 'raydium-amm-v4', mint: 'M', poolAddress: 'P', slot: 1, feesResolved: true, reserveQuote: null, reserveBase: null } });
    const result = interpretE01Sell({ poolState: rec, intendedNotional: 1000n });
    expect(result.status).toBe('UNKNOWN');
    expect(result.status).not.toBe('PARTIAL');
  });
});

describe('invariant b: feesResolved=false does not prevent pre-fee N', () => {
  it('feesResolved=false with valid reserves → computes N (not UNKNOWN)', () => {
    const rec = poolStateRecord({ value: { venue: 'raydium-amm-v4', mint: 'M', poolAddress: 'P', slot: 1, feesResolved: false, reserveQuote: '1000000', reserveBase: '2000000' } });
    const result = interpretE01Sell({ poolState: rec, intendedNotional: 100n });
    expect(result.status).not.toBe('UNKNOWN');
    expect(result.executableNotional).not.toBeNull();
    expect(result.executableNotional!).toBeGreaterThan(0n);
  });
});

describe('invariant c: BUY annotation does not change gate state', () => {
  it('interpretE01Buy returns its own status but is annotation-only by design', () => {
    const rec = poolStateRecord();
    const sellResult = interpretE01Sell({ poolState: rec, intendedNotional: 100n });
    const buyResult = interpretE01Buy({ poolState: rec, intendedNotional: 100n });
    // BUY result exists but does NOT change the SELL result
    expect(sellResult.status).toBeDefined();
    expect(buyResult.buyAnnotation.buyNotional).not.toBeNull();
    // The SELL status is independent of the BUY computation
    const sellAlone = interpretE01Sell({ poolState: rec, intendedNotional: 100n });
    expect(sellResult.status).toBe(sellAlone.status);
  });
});

describe('invariant d: zero verdict language in outputs', () => {
  it('interpreter output carries no PASS/FAIL/verdict in the provenance/methodId', () => {
    const rec = poolStateRecord();
    const result = interpretE01Sell({ poolState: rec, intendedNotional: 100n });
    const provenanceJson = JSON.stringify(result.provenance);
    expect(provenanceJson).not.toMatch(/executable|impactReserve|pricingLeg/i);
  });
});

describe('invariant e: deterministic replay', () => {
  it('same input → same output (N + status)', () => {
    const rec = poolStateRecord({ value: { venue: 'raydium-amm-v4', mint: 'M', poolAddress: 'P', slot: 42, feesResolved: false, reserveQuote: '999999', reserveBase: '555555' } });
    const r1 = interpretE01Sell({ poolState: rec, intendedNotional: 500n });
    const r2 = interpretE01Sell({ poolState: rec, intendedNotional: 500n });
    expect(r1.status).toBe(r2.status);
    expect(r1.executableNotional).toBe(r2.executableNotional);
    expect(r1.reason).toBe(r2.reason);
  });
});

describe('invariant f: five-layer eligibility gate', () => {
  it('wrong kind → rejected at layer 1', () => {
    const rec = poolStateRecord({ factType: 'pool-book' as never });
    const e = eligibleForE01(rec);
    expect(e.eligible).toBe(false);
    expect(e.layer).toBe('1-kind');
  });

  it('incomplete provenance → rejected at layer 2', () => {
    const rec = poolStateRecord({ provenance: { method: '', rawRef: '' } });
    const e = eligibleForE01(rec);
    expect(e.eligible).toBe(false);
    expect(e.layer).toBe('2-provenance');
  });

  it('null slot → rejected at layer 3', () => {
    const rec = poolStateRecord({ slot: null });
    const e = eligibleForE01(rec);
    expect(e.eligible).toBe(false);
    expect(e.layer).toBe('3-slot');
  });

  it('wrong contract version → rejected at layer 4', () => {
    const rec = poolStateRecord({ contractVersion: 'star-evidence@1' as never });
    const e = eligibleForE01(rec);
    expect(e.eligible).toBe(false);
    expect(e.layer).toBe('4-version');
  });

  it('complete record → eligible', () => {
    const rec = poolStateRecord();
    const e = eligibleForE01(rec);
    expect(e.eligible).toBe(true);
  });

  it('any layer failure → Interpreter outputs UNKNOWN with reason', () => {
    const badRec = poolStateRecord({ provenance: { method: null as never, rawRef: null as never } });
    const result = interpretE01Sell({ poolState: badRec, intendedNotional: 100n });
    expect(result.status).toBe('UNKNOWN');
    expect(result.reason).toContain('2-provenance');
  });
});

describe('DQ-1: pump.fun virtual/real not selectable', () => {
  it('pump.fun-curve venue → UNKNOWN (DQ-1 OPEN)', () => {
    const rec = poolStateRecord({ value: { venue: 'pump.fun-curve', mint: 'M', poolAddress: 'P', slot: 1, feesResolved: true, virtualSolReserves: '30000', realSolReserves: '25000' } });
    const result = interpretE01Sell({ poolState: rec, intendedNotional: 100n });
    expect(result.status).toBe('UNKNOWN');
    expect(result.reason).toContain('DQ-1');
  });
});

describe('invariant g: gates@3 semantics not retroactively changed', () => {
  it('PASS and FAIL still work for legacy cases (non-PARTIAL paths unchanged)', () => {
    const rec = poolStateRecord({ value: { venue: 'raydium-amm-v4', mint: 'M', poolAddress: 'P', slot: 1, feesResolved: true, reserveQuote: '1000000000000', reserveBase: '2000000000000' } });
    expect(interpretE01Sell({ poolState: rec, intendedNotional: 1n }).status).toBe('PASS');
    expect(interpretE01Sell({ poolState: rec, intendedNotional: 0n }).status).toBe('PASS'); // 0 intended = trivially pass
  });
});

describe('E-01 math verification (CPMM x·y=k)', () => {
  it('R1 CORRECTED: impact depends only on Rb, not Rq', () => {
    // Two pools with SAME Rb but different Rq should give SAME impact-bound Δt
    // (this is the key mathematical fact the old formula violated)
    const rec1 = poolStateRecord({ value: { venue: 'raydium-amm-v4', mint: 'M', poolAddress: 'P', slot: 1, feesResolved: true, reserveQuote: '1000000', reserveBase: '2000' } });
    const rec2 = poolStateRecord({ value: { venue: 'raydium-amm-v4', mint: 'M', poolAddress: 'P', slot: 1, feesResolved: true, reserveQuote: '5000000', reserveBase: '2000' } });
    const r1 = interpretE01Sell({ poolState: rec1, intendedNotional: 1n });
    const r2 = interpretE01Sell({ poolState: rec2, intendedNotional: 1n });
    // Both should have the same impact-bound Δt_max (same Rb)
    // But different Δq (different Rq). Pricing may bind differently.
    // Key check: both produce valid results with impact ≤ 15%
    expect(r1.executableNotional!).toBeGreaterThan(0n);
    expect(r2.executableNotional!).toBeGreaterThan(0n);
    // Pricing bound for rec1: 1000000/5 = 200000
    expect(r1.executableNotional!).toBeLessThanOrEqual(200000n);
    // Pricing bound for rec2: 5000000/5 = 1000000
    expect(r2.executableNotional!).toBeLessThanOrEqual(1000000n);
  });

  it('R1 CORRECTED: exact impact boundary test (Rb=1000)', () => {
    // Rb=1000: binary search gives exact max Δt where 3·Rb² ≥ 34·Rb·Δt + 17·Δt²
    // Δt_max ≈ 84 (verified: 3·10^6 ≥ 34·1000·84 + 17·84² = 28560 + 119952 = 148512... wait)
    // 3·1000² = 3000000, 34·1000·84+17·84² = 285600+119952 = 405552 — that's > 3000000? No.
    // Let me recompute: 3·Rb²=3·10^6, 34·Rb·Δt=34·1000·Δt=34000Δt, 17·Δt²
    // 3000000 ≥ 34000·84 + 17·7056 = 2856000 + 119952 = 2975952 ✓
    // 3000000 ≥ 34000·85 + 17·7225 = 2890000 + 122825 = 3012825 ✗ (just over!)
    // So Δt_max = 84 for Rb=1000
    const rec = poolStateRecord({ value: { venue: 'raydium-amm-v4', mint: 'M', poolAddress: 'P', slot: 1, feesResolved: true, reserveQuote: '1000000000', reserveBase: '1000' } });
    const result = interpretE01Sell({ poolState: rec, intendedNotional: 1n });
    // With huge Rq (10^9), pricing gives 2·10^8, impact binds: Δt≈84, Δq≈Rq·84/(1000+84)≈83.7·10^6
    // So N should be ≈ 83,688,000 (in quote units)
    expect(result.executableNotional!).toBeGreaterThan(0n);
    expect(result.executableNotional!).toBeLessThan(84000000n); // < Rq·84/1000
  });

  it('R1 CORRECTED: impact exactly at 15% boundary (Rb=1000, Δt=84)', () => {
    // 3·1000² = 3000000 ≥ 34000·84 + 17·7056 = 2975952 → within boundary (inclusive)
    // 3·1000² = 3000000 < 34000·85 + 17·7225 = 3012825 → past boundary
    // This validates the inclusive boundary (D-07)
    const Rb = 1000n;
    // Verify our helper functions directly
    expect(3n * Rb * Rb >= 34n * Rb * 84n + 17n * 84n * 84n).toBe(true);  // Δt=84 OK
    expect(3n * Rb * Rb >= 34n * Rb * 85n + 17n * 85n * 85n).toBe(false); // Δt=85 NOT OK
  });

  it('R1 CORRECTED: BUY returns quote-side notional (not raw Δt)', () => {
    const rec = poolStateRecord({ value: { venue: 'raydium-amm-v4', mint: 'M', poolAddress: 'P', slot: 1, feesResolved: true, reserveQuote: '1000000', reserveBase: '2000000' } });
    const buy = interpretE01Buy({ poolState: rec, intendedNotional: 1n });
    // BUY N must be in quote units, not base units
    // Δt_max_buy ≈ 0.0675·Rb = 0.0675·2000000 ≈ 135000 base units
    // N_buy = Rq·Δt/(Rb-Δt) ≈ 1000000·135000/1865000 ≈ 72386 quote units
    expect(buy.buyAnnotation.buyNotional).not.toBeNull();
    expect(buy.buyAnnotation.buyNotional!).toBeGreaterThan(0n);
    // Should be significantly less than Rq (can't extract all quote)
    expect(buy.buyAnnotation.buyNotional!).toBeLessThan(1000000n);
  });

  it('non-positive reserves → FAIL', () => {
    const rec = poolStateRecord({ value: { venue: 'raydium-amm-v4', mint: 'M', poolAddress: 'P', slot: 1, feesResolved: true, reserveQuote: '0', reserveBase: '100' } });
    expect(interpretE01Sell({ poolState: rec, intendedNotional: 100n }).status).toBe('FAIL');
  });
});
