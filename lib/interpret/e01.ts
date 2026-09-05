/**
 * E-01 Interpreter — F2-B Audit Remediation R1 (authorized 2026-09-05).
 *
 * CORRECTED CPMM impact formula (audited by principal — Rq CANCELS):
 *
 *   SELL Δt base into pool (Rq, Rb):
 *     CPMM: Δq = Rq·Δt/(Rb+Δt)
 *     p_post/p_pre = Rb²/(Rb+Δt)²   [Rq does NOT appear]
 *     impact ≤ 0.15 ⟺ 100·Rb² ≥ 85·(Rb+Δt)² ⟺ 3·Rb² ≥ 34·Rb·Δt + 17·Δt²
 *
 *   BUY Δt base from pool (Rq, Rb):
 *     CPMM: Δq = Rq·Δt/(Rb−Δt)
 *     p_post/p_pre = Rb²/(Rb−Δt)²   [Rq does NOT appear]
 *     impact ≤ 0.15 ⟺ 100·Rb² ≤ 115·(Rb−Δt)²
 *
 * Both constraints depend ONLY on Rb — the original formula that included
 * Rq was mathematically incorrect and has been replaced.
 *
 * Unit convention: N is in quote-side raw units (same as reserveQuote).
 * The caller must ensure intendedNotional is in the same unit as reserveQuote.
 * BUY N_buy is converted from Δt to quote-side units via CPMM (audit fix).
 */
import type { EvidenceRecord } from '@/lib/evidence/contract';
import { EVIDENCE_CONTRACT_VERSION } from '@/lib/evidence/contract';

export type E01GateStatus = 'PASS' | 'FAIL' | 'PARTIAL' | 'UNKNOWN';

export interface E01Result {
  status: E01GateStatus;
  /** Pre-fee executable notional — in the SAME raw units as reserveQuote. */
  executableNotional: bigint | null;
  buyAnnotation: {
    /** BUY notional — in quote-side raw units (converted from Δt), or null. */
    buyNotional: bigint | null;
    buyStatus: 'computed' | 'unknown';
    reason?: string;
  };
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

const E01_VERSION = 'E-01-FROZEN-v1';
const GATE_VERSION = 'gates@4';

// ── Five-layer eligibility gate (Interpreter Auth Review ①) ──

export function eligibleForE01(record: EvidenceRecord): { eligible: boolean; layer?: string; reason?: string } {
  if (record.factType !== 'pool-state') {
    return { eligible: false, layer: '1-kind', reason: `kind '${record.factType}' not pool-state` };
  }
  if (!record.provenance?.method || !record.provenance?.rawRef) {
    return { eligible: false, layer: '2-provenance', reason: 'provenance method/rawRef incomplete' };
  }
  if (record.slot == null || typeof record.slot !== 'number' || record.slot < 0 || !Number.isInteger(record.slot)) {
    return { eligible: false, layer: '3-slot', reason: 'slot null or non-integer' };
  }
  if (record.contractVersion !== EVIDENCE_CONTRACT_VERSION) {
    return { eligible: false, layer: '4-version', reason: `contractVersion ${record.contractVersion} ≠ ${EVIDENCE_CONTRACT_VERSION}` };
  }
  return { eligible: true };
}

// ── Corrected CPMM impact (depends only on Rb, NOT Rq) ──

/** SELL impact check: 3·Rb² ≥ 34·Rb·Δt + 17·Δt² */
function sellImpactOK(Rb: bigint, dt: bigint): boolean {
  return 3n * Rb * Rb >= 34n * Rb * dt + 17n * dt * dt;
}

/** BUY impact check: 100·Rb² ≤ 115·(Rb−Δt)² + domain Rb−Δt > 0 */
function buyImpactOK(Rb: bigint, dt: bigint): boolean {
  if (dt >= Rb) return false;
  const rem = Rb - dt;
  return 100n * Rb * Rb <= 115n * rem * rem;
}

/** Binary search for exact max Δt — no floating point, no √ approximation. */
function sellMaxDt(Rb: bigint): bigint {
  let lo = 0n, hi = Rb;
  while (lo < hi) {
    const mid = (lo + hi + 1n) / 2n;
    if (sellImpactOK(Rb, mid)) lo = mid; else hi = mid - 1n;
  }
  return lo;
}

function buyMaxDt(Rb: bigint): bigint {
  let lo = 0n, hi = Rb - 1n;
  while (lo < hi) {
    const mid = (lo + hi + 1n) / 2n;
    if (buyImpactOK(Rb, mid)) lo = mid; else hi = mid - 1n;
  }
  return lo;
}

/** CPMM Δt→Δq conversion. SELL: Rq·Δt/(Rb+Δt). BUY: Rq·Δt/(Rb−Δt). */
function sellDtToDq(Rq: bigint, Rb: bigint, dt: bigint): bigint {
  return (Rq * dt) / (Rb + dt);
}
function buyDtToDq(Rq: bigint, Rb: bigint, dt: bigint): bigint {
  const rem = Rb - dt;
  return rem <= 0n ? 0n : (Rq * dt) / rem;
}

/** Pricing leg: Δq ≤ Rq/5 (keep ≥80% quote side). Integer: 5·Δq ≤ Rq. */
function pricingLegMaxDq(Rq: bigint): bigint {
  return Rq / 5n;
}

/** Post-computation verification (integer cross-multiplication, both constraints). */
function verifySellResult(Rq: bigint, Rb: bigint, N: bigint): boolean {
  if (5n * N > Rq) return false; // pricing leg violated
  if (N >= Rq) return false;
  const dt = (N * Rb) / (Rq - N); // invert CPMM to get Δt
  return sellImpactOK(Rb, dt);
}

// ── Main Interpreter ──

export interface E01Input {
  poolState: EvidenceRecord;
  /** Intended notional — MUST be in the same raw units as reserveQuote. */
  intendedNotional: bigint;
}

export function interpretE01Sell(input: E01Input): E01Result {
  const { poolState, intendedNotional } = input;
  const prov: E01Provenance = {
    inputEvidenceIds: [poolState.evidenceId],
    inputSlots: [poolState.slot],
    canonicalPool: poolState.value['poolAddress'] as string ?? null,
    e01ContractVersion: E01_VERSION,
    gateVersion: GATE_VERSION,
    methodId: 'e01-cpmm-sell-v2-corrected',
  };

  const eligibility = eligibleForE01(poolState);
  if (!eligibility.eligible) {
    return unknownResult(`Layer ${eligibility.layer}: ${eligibility.reason}`, prov);
  }

  const value = poolState.value as Record<string, unknown>;
  if (value['venue'] === 'pump.fun-curve') {
    return unknownResult('DQ-1 OPEN: pump.fun virtual/real not governance-authorized', prov);
  }

  const Rq = value['reserveQuote'] != null ? BigInt(value['reserveQuote'] as string) : null;
  const Rb = value['reserveBase'] != null ? BigInt(value['reserveBase'] as string) : null;
  if (Rq == null || Rb == null) {
    return unknownResult(`E-01 required input '${Rq == null ? 'reserveQuote' : 'reserveBase'}' is null`, prov);
  }
  if (Rq <= 0n || Rb <= 0n) {
    return failResult(0n, 'Reserves non-positive — no executable depth', prov);
  }

  // Pricing leg bound
  const dqPricing = pricingLegMaxDq(Rq);
  // Impact bound (corrected: depends only on Rb)
  const dtImpactMax = sellMaxDt(Rb);
  const dqImpact = sellDtToDq(Rq, Rb, dtImpactMax);
  // N = min of both bounds, in quote-side raw units
  const N = dqPricing < dqImpact ? dqPricing : dqImpact;

  // Verify (integer cross-multiplication)
  if (!verifySellResult(Rq, Rb, N)) {
    return unknownResult('Post-computation verification failed', prov);
  }

  if (N === 0n) return failResult(N, 'N = 0', prov);
  if (N >= intendedNotional) return passResult(N, `N=${N} ≥ intended=${intendedNotional}`, prov);
  return partialResult(N, intendedNotional, prov);
}

export function interpretE01Buy(input: E01Input): E01Result {
  const { poolState, intendedNotional } = input;
  const prov: E01Provenance = {
    inputEvidenceIds: [poolState.evidenceId],
    inputSlots: [poolState.slot],
    canonicalPool: poolState.value['poolAddress'] as string ?? null,
    e01ContractVersion: E01_VERSION,
    gateVersion: GATE_VERSION,
    methodId: 'e01-cpmm-buy-v2-corrected',
  };

  const eligibility = eligibleForE01(poolState);
  if (!eligibility.eligible) return unknownResult(`Layer ${eligibility.layer}: ${eligibility.reason}`, prov);

  const value = poolState.value as Record<string, unknown>;
  if (value['venue'] === 'pump.fun-curve') return unknownResult('DQ-1 OPEN', prov);

  const Rq = value['reserveQuote'] != null ? BigInt(value['reserveQuote'] as string) : null;
  const Rb = value['reserveBase'] != null ? BigInt(value['reserveBase'] as string) : null;
  if (Rq == null || Rb == null || Rq <= 0n || Rb <= 0n) return unknownResult('Reserves null or non-positive', prov);

  const dtBuyMax = buyMaxDt(Rb);
  const N_buy = buyDtToDq(Rq, Rb, dtBuyMax); // converted to quote units (audit fix)

  return {
    status: N_buy >= intendedNotional ? 'PASS' : N_buy === 0n ? 'FAIL' : 'PARTIAL',
    executableNotional: N_buy,
    buyAnnotation: { buyNotional: N_buy, buyStatus: 'computed' },
    reason: `BUY N=${N_buy} (quote units, annotation only)`,
    provenance: prov,
  };
}

function passResult(N: bigint, reason: string, prov: E01Provenance): E01Result {
  return { status: 'PASS', executableNotional: N, buyAnnotation: { buyNotional: null, buyStatus: 'unknown' }, reason, provenance: prov };
}
function failResult(N: bigint, reason: string, prov: E01Provenance): E01Result {
  return { status: 'FAIL', executableNotional: N, buyAnnotation: { buyNotional: null, buyStatus: 'unknown' }, reason, provenance: prov };
}
function partialResult(N: bigint, intended: bigint, prov: E01Provenance): E01Result {
  return { status: 'PARTIAL', executableNotional: N, buyAnnotation: { buyNotional: null, buyStatus: 'unknown' }, reason: `Partial capacity: N=${N} < intended=${intended}`, provenance: prov };
}
function unknownResult(reason: string, prov: E01Provenance): E01Result {
  return { status: 'UNKNOWN', executableNotional: null, buyAnnotation: { buyNotional: null, buyStatus: 'unknown', reason: 'see SELL' }, reason, provenance: prov };
}
