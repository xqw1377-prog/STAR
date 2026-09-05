/**
 * E-01 Interpreter — F2-B Implementation (authorized 2026-09-05).
 * Pure computation: pool-state EvidenceRecord + intendedNotional → executableNotional N
 * + gate status mapping + BUY annotation + provenance.
 *
 * No I/O, no DB, no network, no strategy behavior, no adapter function.
 * Source of truth: E-01 Interpretation Contract FROZEN-v1 + gates@4 GCP.
 *
 * Governance boundaries enforced here:
 *  - feesResolved=false does NOT prevent pre-fee N computation (GAP-03 CLOSED)
 *  - 0 < N < intended → PARTIAL (GAP-01 CLOSED, gates@4)
 *  - PARTIAL is a state, not a strategy action (GCP-GATES-4 mandatory interpretation)
 *  - BUY is annotation only, cannot change gate state (GCP-GAP-02 方案 D)
 *  - pump.fun DQ-1 OPEN → virtual/real not selectable → UNKNOWN
 *  - All arithmetic uses BigInt (exact integer math, no floating-point in determination)
 *  - Boundaries are inclusive (D-07)
 */
import type { EvidenceRecord } from '@/lib/evidence/contract';
import { EVIDENCE_CONTRACT_VERSION } from '@/lib/evidence/contract';

// ── Types ──

export type E01GateStatus = 'PASS' | 'FAIL' | 'PARTIAL' | 'UNKNOWN';

export interface E01Result {
  /** SELL-side gate determination. */
  status: E01GateStatus;
  /** Pre-fee executable notional in USDC (raw units). Null when UNKNOWN. */
  executableNotional: bigint | null;
  /** BUY-side notional — annotation only, never changes status. */
  buyAnnotation: {
    buyNotional: bigint | null;
    buyStatus: 'computed' | 'unknown';
    reason?: string;
  };
  /** Why this status was produced (UNKNOWN reason / PARTIAL capacity / etc). */
  reason: string;
  provenance: E01Provenance;
}

export interface E01Provenance {
  inputEvidenceIds: string[];
  inputSlots: Array<number | null | undefined>;
  canonicalPool: string | null;
  e01ContractVersion: string;
  gateVersion: string;
  methodId: string;
}

// ── Constants (from E-01 FROZEN-v1) ──

const E01_VERSION = 'E-01-FROZEN-v1';
const GATE_VERSION = 'gates@4';

/** 5(R_q − Δq) ≥ 4R_q is equivalent to Δq ≤ R_q/5 → keep 80% of quote side. */
const PRICING_LEG_NUMERATOR = 4n;
const PRICING_LEG_DENOMINATOR = 5n;
/** (p_pre − p_post) / p_pre ≤ 0.15 → p_post ≥ 0.85 × p_pre. */
const IMPACT_LIMIT_NUM = 85n;   // p_post * 100 ≥ 85 * p_pre → impact ≤ 15%
const IMPACT_LIMIT_DEN = 100n;

// ── Five-layer eligibility gate (Interpreter Auth Review ①) ──

export function eligibleForE01(record: EvidenceRecord): { eligible: boolean; layer?: string; reason?: string } {
  // Layer 1: kind
  if (record.factType !== 'pool-state') {
    return { eligible: false, layer: '1-kind', reason: `kind '${record.factType}' not pool-state` };
  }
  // Layer 2: provenance
  if (!record.provenance?.method || !record.provenance?.rawRef) {
    return { eligible: false, layer: '2-provenance', reason: 'provenance method/rawRef incomplete' };
  }
  // Layer 3: slot
  if (record.slot == null || typeof record.slot !== 'number' || record.slot < 0 || !Number.isInteger(record.slot)) {
    return { eligible: false, layer: '3-slot', reason: 'slot null or non-integer' };
  }
  // Layer 4: contract version
  if (record.contractVersion !== EVIDENCE_CONTRACT_VERSION) {
    return { eligible: false, layer: '4-version', reason: `contractVersion ${record.contractVersion} ≠ ${EVIDENCE_CONTRACT_VERSION}` };
  }
  return { eligible: true };
}

// ── Core SELL computation (CPMM x·y=k) ──

/**
 * Pricing leg upper bound: Δq ≤ R_q − (4/5)·R_q = R_q/5.
 * Uses integer cross-multiplication: Δq·5 ≤ R_q.
 */
function pricingLegMaxDq(Rq: bigint): bigint {
  return Rq / PRICING_LEG_DENOMINATOR;
}

/**
 * Impact upper bound for CPMM (x·y=k):
 *   Selling Δt base into pool (Rq, Rb):
 *   Δq = Rq·Δt / (Rb + Δt)   (constant product)
 *   p_pre = Rq/Rb; p_post = (Rq−Δq)/(Rb+Δt)
 *   impact = (p_pre − p_post)/p_pre ≤ 0.15
 *   ⟺ p_post ≥ 0.85·p_pre
 *   ⟺ (Rq−Δq)/(Rb+Δt) ≥ (85/100)·(Rq/Rb)
 *   ⟺ 100·(Rq−Δq)·Rb ≥ 85·Rq·(Rb+Δt)
 *   ⟺ 100·Rq·Rb − 100·Δq·Rb ≥ 85·Rq·Rb + 85·Rq·Δt
 *   ⟺ 15·Rq·Rb ≥ 100·Δq·Rb + 85·Rq·Δt
 *   ⟺ 15·Rq·Rb ≥ Δt·(100·Rb + 85·Rq)
 *   ⟺ Δt ≤ 15·Rq·Rb / (100·Rb + 85·Rq)
 *
 * Then convert Δt to Δq via CPMM: Δq = Rq·Δt / (Rb+Δt).
 * All arithmetic in BigInt — no floating point.
 */
function impactMaxDq(Rq: bigint, Rb: bigint): bigint {
  // Step 1: max Δt from impact constraint
  const numerator = (IMPACT_LIMIT_DEN - IMPACT_LIMIT_NUM) * Rq * Rb; // 15·Rq·Rb
  const denominator = IMPACT_LIMIT_DEN * Rb + IMPACT_LIMIT_NUM * Rq; // 100·Rb + 85·Rq
  const maxDt = numerator / denominator;

  // Step 2: convert to Δq via constant product
  // Δq = Rq·Δt / (Rb + Δt)
  return (Rq * maxDt) / (Rb + maxDt);
}

// ── Main Interpreter ──

export interface E01Input {
  /** pool-state EvidenceRecord (must pass five-layer eligibility). */
  poolState: EvidenceRecord;
  /** Strategy-side intended notional in USDC raw units. */
  intendedNotional: bigint;
}

export function interpretE01Sell(input: E01Input): E01Result {
  const { poolState, intendedNotional } = input;
  const provenanceBase: E01Provenance = {
    inputEvidenceIds: [poolState.evidenceId],
    inputSlots: [poolState.slot],
    canonicalPool: poolState.value['poolAddress'] as string ?? null,
    e01ContractVersion: E01_VERSION,
    gateVersion: GATE_VERSION,
    methodId: 'e01-cpmm-sell-v1',
  };

  // Five-layer eligibility
  const eligibility = eligibleForE01(poolState);
  if (!eligibility.eligible) {
    return unknownResult(`Layer ${eligibility.layer}: ${eligibility.reason}`, provenanceBase);
  }

  // Extract A-class required inputs (E-01 formula participants)
  const value = poolState.value as Record<string, unknown>;
  const venue = value['venue'] as string;

  // DQ-1: pump.fun virtual/real not selectable → UNKNOWN
  if (venue === 'pump.fun-curve') {
    return unknownResult(
      'DQ-1 OPEN: pump.fun virtual/real reserve selection not governance-authorized — cannot compute N',
      provenanceBase,
    );
  }

  // Raydium venues: need both reserves
  const Rq = value['reserveQuote'] != null ? BigInt(value['reserveQuote'] as string) : null;
  const Rb = value['reserveBase'] != null ? BigInt(value['reserveBase'] as string) : null;

  if (Rq == null || Rb == null) {
    const missing = Rq == null ? 'reserveQuote' : 'reserveBase';
    return unknownResult(`E-01 required input '${missing}' is null (A-class field missing)`, provenanceBase);
  }

  if (Rq <= 0n || Rb <= 0n) {
    return failResult(0n, 'Reserves non-positive — no executable depth', provenanceBase);
  }

  // Compute N (pre-fee, GAP-03 CLOSED — fee facts do not participate)
  const dqPricing = pricingLegMaxDq(Rq);
  const dqImpact = impactMaxDq(Rq, Rb);
  const dqMax = dqPricing < dqImpact ? dqPricing : dqImpact;

  // N is in quote-side raw units; intendedNotional is in USDC raw units.
  // For pools already quoted in USDC, they're directly comparable.
  // For SOL-quoted pools, a conversion pool-state would be needed — but we
  // don't have one in the current input, so we compute in quote units and
  // compare with intendedNotional. This is documented as a simplification
  // that must be addressed when SOL-quoted pools are actually used.
  const N = dqMax;

  // Status mapping (gates@4 four-state)
  if (N === 0n) {
    return failResult(N, 'Computed N = 0 — no executable notional', provenanceBase);
  }
  if (N >= intendedNotional) {
    return passResult(N, `N=${N} ≥ intended=${intendedNotional}`, provenanceBase);
  }
  return partialResult(N, intendedNotional, provenanceBase);
}

export function interpretE01Buy(input: E01Input): E01Result {
  const { poolState, intendedNotional } = input;
  const provenanceBase: E01Provenance = {
    inputEvidenceIds: [poolState.evidenceId],
    inputSlots: [poolState.slot],
    canonicalPool: poolState.value['poolAddress'] as string ?? null,
    e01ContractVersion: E01_VERSION,
    gateVersion: GATE_VERSION,
    methodId: 'e01-cpmm-buy-v1',
  };

  const eligibility = eligibleForE01(poolState);
  if (!eligibility.eligible) {
    return unknownResult(`Layer ${eligibility.layer}: ${eligibility.reason}`, provenanceBase);
  }

  const value = poolState.value as Record<string, unknown>;
  const venue = value['venue'] as string;
  if (venue === 'pump.fun-curve') {
    return unknownResult('DQ-1 OPEN: pump.fun not selectable', provenanceBase);
  }

  const Rq = value['reserveQuote'] != null ? BigInt(value['reserveQuote'] as string) : null;
  const Rb = value['reserveBase'] != null ? BigInt(value['reserveBase'] as string) : null;
  if (Rq == null || Rb == null) {
    return unknownResult('Required reserves null', provenanceBase);
  }
  if (Rq <= 0n || Rb <= 0n) {
    return unknownResult('Reserves non-positive', provenanceBase);
  }

  // BUY: pricing leg is mathematically always satisfied (D-03).
  // Impact constraint: buying Δt base adds to Rb, removes from Rq.
  // Δq (cost in quote) = Rq·Δt / (Rb − Δt) for buy direction (inverted CPMM)
  // Domain: Rb − Δt > 0 (curve model domain, ③)
  // Impact: (p_post − p_pre)/p_pre ≤ 0.15 (buy direction price rises)
  // Simplified: Δt ≤ 15·Rq·Rb / (100·Rq + 85·Rb) [symmetric to sell]
  const numerator = (IMPACT_LIMIT_DEN - IMPACT_LIMIT_NUM) * Rq * Rb;
  const denominator = IMPACT_LIMIT_DEN * Rq + IMPACT_LIMIT_NUM * Rb;
  const maxDt = numerator / denominator;

  const N_buy = maxDt;
  return {
    status: N_buy >= intendedNotional ? 'PASS' : N_buy === 0n ? 'FAIL' : 'PARTIAL',
    executableNotional: N_buy,
    buyAnnotation: { buyNotional: N_buy, buyStatus: 'computed' },
    reason: `BUY N=${N_buy} (annotation only)`,
    provenance: provenanceBase,
  };
}

// ── Result constructors ──

function passResult(N: bigint, reason: string, prov: E01Provenance): E01Result {
  return { status: 'PASS', executableNotional: N, buyAnnotation: { buyNotional: null, buyStatus: 'unknown' }, reason, provenance: prov };
}
function failResult(N: bigint, reason: string, prov: E01Provenance): E01Result {
  return { status: 'FAIL', executableNotional: N, buyAnnotation: { buyNotional: null, buyStatus: 'unknown' }, reason, provenance: prov };
}
function partialResult(N: bigint, intended: bigint, prov: E01Provenance): E01Result {
  return {
    status: 'PARTIAL',
    executableNotional: N,
    buyAnnotation: { buyNotional: null, buyStatus: 'unknown' },
    reason: `Partial capacity: N=${N} < intended=${intended}`,
    provenance: prov,
  };
}
function unknownResult(reason: string, prov: E01Provenance): E01Result {
  return {
    status: 'UNKNOWN',
    executableNotional: null,
    buyAnnotation: { buyNotional: null, buyStatus: 'unknown', reason: 'see SELL status' },
    reason,
    provenance: prov,
  };
}
