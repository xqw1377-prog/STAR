/**
 * Reserve/Curve Fact Adapter acceptance tests (implementation gate,
 * CCP-01/02/03 authorized 2026-09-05). Locked invariants:
 *  - facts answer "what did the provider report", never E-01 questions
 *  - virtual AND real coexist (DQ-1 OPEN — no collapsing, MUST NOT)
 *  - partial facts preserved (DQ-2 CLOSED) with feesResolved flags
 *  - missing stays missing; mint-mismatch rejects the whole fact
 *  - provenance declares its hash input layer (raw-bytes vs structured)
 *  - payload validator rejects E-01-flavored keys (design hard boundary)
 *  - pool-state has EMPTY gate eligibility (E-01 via Interpreter only)
 *  - layout debt: pump.fun offsets marked PENDING-ON-CHAIN
 */
import { describe, expect, it } from 'vitest';
import { EVIDENCE_CONTRACT_VERSION, EVIDENCE_FACT_TYPES, EvidenceContractViolation, assertEvidence, gateEligibility, type EvidenceRecord } from '@/lib/evidence/contract';
import { PUMP_CURVE_LAYOUT, buildPumpCurvePoolState, buildRaydiumPoolState, fixtureCurveAccountBytes } from './adapter';

const OBS = '2026-09-04T00:00:00.000Z';
const MINT = 'PumpMint111111111111111111111111111111111';
const POOL = 'PumpPool11111111111111111111111111111111';

function poolStateRecord(value: Record<string, unknown>): EvidenceRecord {
  return {
    evidenceId: 'ev-poolstate-test-1',
    contractVersion: EVIDENCE_CONTRACT_VERSION,
    cap: 'CAP-02-CHAIN',
    source: 'synthetic-fixtures',
    adapter: 'reserve-curve-fact-adapter',
    entityType: 'pool',
    entityId: 'raydium-amm-v4:test',
    factType: 'pool-state',
    value,
    observedAt: OBS,
    slot: 1200,
    txSignatures: [],
    confidence: null,
    provenance: { method: 'decode:pool-account-layout' },
  };
}

describe('Evidence @2: pool-state vocabulary and structural validator', () => {
  it('@2 is live; pool-state is whitelisted with EMPTY gate eligibility', () => {
    expect(EVIDENCE_CONTRACT_VERSION).toBe('star-evidence@2');
    expect(EVIDENCE_FACT_TYPES).toContain('pool-state');
    expect(gateEligibility('pool-state')).toEqual([]);
  });

  it('structural validator accepts a complete pool-state payload', () => {
    const r = poolStateRecord({
      mint: MINT, poolAddress: POOL, venue: 'raydium-amm-v4', slot: 1200, feesResolved: false,
      reserveQuote: '3000000000', reserveBase: '2000000000',
    });
    expect(() => assertEvidence(r)).not.toThrow();
  });

  it('validator enforces structural completeness (venue / feesResolved / raw strings)', () => {
    expect(() => assertEvidence(poolStateRecord({ mint: MINT, poolAddress: POOL, venue: 'unknown-venue', feesResolved: false }))).toThrow(EvidenceContractViolation);
    expect(() => assertEvidence(poolStateRecord({ mint: MINT, poolAddress: POOL, venue: 'raydium-amm-v4' }))).toThrow(/feesResolved/);
    expect(() => assertEvidence(poolStateRecord({ mint: MINT, venue: 'raydium-amm-v4', feesResolved: false }))).toThrow(/poolAddress/);
    expect(() => assertEvidence(poolStateRecord({ mint: MINT, poolAddress: POOL, venue: 'raydium-cpmm', feesResolved: true, reserveQuote: 3.5 }))).toThrow(/reserveQuote/);
    expect(() => assertEvidence(poolStateRecord({ mint: MINT, poolAddress: POOL, venue: 'raydium-cpmm', feesResolved: false, slot: -1 }))).toThrow(/slot/);
  });

  it('validator REJECTS E-01-flavored keys (design hard boundary)', () => {
    expect(() => assertEvidence(poolStateRecord({ mint: MINT, poolAddress: POOL, venue: 'raydium-amm-v4', feesResolved: false, executableReserve: '1' }))).toThrow(/smuggles E-01/);
    expect(() => assertEvidence(poolStateRecord({ mint: MINT, poolAddress: POOL, venue: 'raydium-amm-v4', feesResolved: false, impactReserve: '1' }))).toThrow(/smuggles E-01/);
    expect(() => assertEvidence(poolStateRecord({ mint: MINT, poolAddress: POOL, venue: 'raydium-amm-v4', feesResolved: false, pricingLeg: 0.8 }))).toThrow(/smuggles E-01/);
  });

  it('pool-book keeps its @1 semantics (no breaking change — CCP path b)', () => {
    const legacy = poolStateRecord({ mint: MINT, poolAddress: POOL, venue: 'raydium-amm-v4', feesResolved: false });
    legacy.factType = 'pool-book';
    // pool-book has NO per-kind validator at @2 (CCP-02: new kinds only)
    expect(() => assertEvidence(legacy)).not.toThrow();
  });
});

describe('Raydium adapter: jsonParsed vaults, partial facts, mint-match', () => {
  it('emits a contract-valid fact with reserves from vault token accounts', async () => {
    const rec = await buildRaydiumPoolState({
      venue: 'raydium-amm-v4', mint: MINT, poolAddress: POOL,
      vaultQuote: { mint: MINT, amount: '3000000000' },
      vaultBase: { mint: 'OtherMint1111111111111111111111111111111111', amount: '2000000000' },
      contextSlot: 1200, observedAt: OBS,
    });
    expect(rec.factType).toBe('pool-state');
    expect(rec.value.reserveQuote).toBe('3000000000');
    expect(rec.value.reserveBase).toBe('2000000000');
    expect(rec.slot).toBe(1200); // F3: response context.slot, never a separate clock
  });

  it('partial facts preserved: missing vault stays missing, fees flagged unresolved (DQ-2)', async () => {
    const rec = await buildRaydiumPoolState({
      venue: 'raydium-cpmm', mint: MINT, poolAddress: POOL,
      vaultQuote: { mint: MINT, amount: '3000000000' },
      vaultBase: null, contextSlot: null, observedAt: OBS,
    });
    expect(rec.value.reserveQuote).toBe('3000000000');
    expect(rec.value).not.toHaveProperty('reserveBase'); // missing stays missing — no ?? 0
    expect(rec.value.feesResolved).toBe(false);
    expect(rec.slot).toBeNull();
  });

  it('mint mismatch rejects the whole fact (never a wrong-side guess)', async () => {
    await expect(buildRaydiumPoolState({
      venue: 'raydium-amm-v4', mint: 'NotInPool11111111111111111111111111111111', poolAddress: POOL,
      vaultQuote: { mint: MINT, amount: '1' },
      vaultBase: { mint: 'OtherMint1111111111111111111111111111111111', amount: '2' },
      contextSlot: 1, observedAt: OBS,
    })).rejects.toThrow(/matches neither vault/);
  });

  it('provenance declares hash input layer (structured-input for jsonParsed)', async () => {
    const rec = await buildRaydiumPoolState({
      venue: 'raydium-amm-v4', mint: MINT, poolAddress: POOL,
      vaultQuote: { mint: MINT, amount: '1' }, contextSlot: 1, observedAt: OBS,
    });
    expect(rec.provenance.rawRef).toContain('structured-input:');
    expect(rec.provenance.rawRef).not.toMatch(/^raw-byces/);
  });
});

describe('pump.fun adapter: virtual+real coexist (MUST NOT collapse)', () => {
  it('emits BOTH virtual and real reserves with distinct source semantics', async () => {
    const bytes = fixtureCurveAccountBytes({ virtualSol: 30n, realSol: 25n });
    const rec = await buildPumpCurvePoolState({ mint: MINT, poolAddress: POOL, curveAccountBytes: bytes, contextSlot: 42, observedAt: OBS });
    expect(rec.value.venue).toBe('pump.fun-curve');
    expect(rec.value.virtualSolReserves).toBe('30');
    expect(rec.value.realSolReserves).toBe('25');
    expect(rec.value.virtualTokenReserves).toBeDefined();
    expect(rec.value.realTokenReserves).toBeDefined();
    expect(rec.value.complete).toBe(false);
  });

  it('raw-bytes provenance layer declared for byte-decoded input', async () => {
    const rec = await buildPumpCurvePoolState({ mint: MINT, poolAddress: POOL, curveAccountBytes: fixtureCurveAccountBytes(), contextSlot: 1, observedAt: OBS });
    expect(rec.provenance.rawRef).toContain('raw-bytes:');
  });

  it('too-short account rejects the fact (no partial decode)', async () => {
    await expect(buildPumpCurvePoolState({ mint: MINT, poolAddress: POOL, curveAccountBytes: new Uint8Array(10), contextSlot: 1, observedAt: OBS }))
      .rejects.toThrow(/too short/);
  });

  it('layout debt is explicit: pump.fun offsets marked PENDING-ON-CHAIN', () => {
    // R-1: must be re-verified against the deployed program before real-RPC gates open
    const marker = 'PENDING-ON-CHAIN';
    expect(PUMP_CURVE_LAYOUT.verification).toBe(marker);
  });
});

describe('governance boundary: adapter answers facts only', () => {
  it('no adapter output ever carries E-01 verdict language', async () => {
    const recs = [
      await buildRaydiumPoolState({ venue: 'raydium-amm-v4', mint: MINT, poolAddress: POOL, vaultQuote: { mint: MINT, amount: '1' }, contextSlot: 1, observedAt: OBS }),
      await buildPumpCurvePoolState({ mint: MINT, poolAddress: POOL, curveAccountBytes: fixtureCurveAccountBytes(), contextSlot: 1, observedAt: OBS }),
    ];
    for (const r of recs) {
      expect(JSON.stringify(r.value)).not.toMatch(/executable|impact|pricing|PASS|FAIL|notional/i);
      expect(gateEligibility(r.factType)).toEqual([]);
    }
  });
});
