/**
 * Reserve/Curve Fact Adapter (implementation authorized 2026-09-05,
 * CCP-01/02/03 rulings). Pure decoding organ:
 *
 *   Provider raw (account bytes / jsonParsed token accounts)
 *     → pool-state EvidenceRecord (@2 vocabulary, assertEvidence-validated)
 *
 * Governance boundaries (frozen):
 *  - Answers ONLY "what facts did the provider report at this point-in-time".
 *    Never E-01 questions (impact/pricing/N/PASS-FAIL) — Interpreter is a
 *    separate, unauthorized layer.
 *  - F1/F5 discipline: raw passthrough, missing stays missing, no defaults.
 *  - pump.fun virtual AND real reserves coexist (DQ-1 OPEN: the choice
 *    belongs to the Interpreter/governance, never here).
 *  - Partial facts preserved (DQ-2 CLOSED): reserves present + fees missing
 *    → feesResolved: false, fact stays.
 *  - Provenance hash declares its input layer: raw-bytes when bytes were
 *    given, structured-input otherwise — a canonicalized-JSON hash may
 *    never masquerade as a raw-response hash.
 *
 * Layout verification debt (Adapter Design R-1): pump.fun bonding-curve byte
 * offsets below follow the publicly documented program layout and are
 * fixture-tested here; they MUST be re-verified against the deployed on-chain
 * program before any real-RPC gate opens (registry stays BLOCKED anyway).
 * Raydium pool-account byte layout is NOT decoded here (fee/vault extraction
 * marked feesResolved:false until on-chain layout verification); reserves
 * come from self-describing jsonParsed vault token accounts — no offsets.
 */
import { EVIDENCE_CONTRACT_VERSION, assertEvidence, type EvidenceRecord } from '@/lib/evidence/contract';
import { sha256hex } from '@/lib/data/hash';

export const RESERVE_ADAPTER_VERSION = 'star-reserve-curve@1';
export const RESERVE_ADAPTER_SOURCE = 'synthetic-fixtures';
export const RESERVE_ADAPTER_ID = 'reserve-curve-fact-adapter';

/** pump.fun bonding curve account layout (documented; on-chain verification pending). */
export const PUMP_CURVE_LAYOUT = {
  verification: 'PENDING-ON-CHAIN' as const,
  discriminator: 8,
  fields: [
    'virtualTokenReserves', 'virtualSolReserves',
    'realTokenReserves', 'realSolReserves', 'tokenTotalSupply',
  ] as const,
  completeFlagByte: 8 + 8 * 5, // after discriminator + 5 u64s
};

export type PoolStateVenue = 'raydium-amm-v4' | 'raydium-cpmm' | 'pump.fun-curve';

export interface RaydiumAdapterInput {
  venue: Exclude<PoolStateVenue, 'pump.fun-curve'>;
  mint: string;
  poolAddress: string;
  /** Requested-side vault token account (jsonParsed), provider raw. */
  vaultQuote?: { mint: string; amount: string } | null;
  /** Other-side vault token account (jsonParsed), provider raw. */
  vaultBase?: { mint: string; amount: string } | null;
  /** Pool account bytes — fee extraction deferred until layout verified on-chain. */
  poolAccountBytes?: Uint8Array | null;
  contextSlot: number | null;
  observedAt: string;
}

export interface PumpAdapterInput {
  mint: string;
  poolAddress: string;
  curveAccountBytes: Uint8Array;
  contextSlot: number | null;
  observedAt: string;
}

interface AdapterBaseInput {
  mint: string;
  poolAddress: string;
  venue: PoolStateVenue;
  observedAt: string;
  contextSlot: number | null;
}

let seq = 0;

async function emit(
  base: AdapterBaseInput,
  value: Record<string, unknown>,
  provenanceInputs: Array<{ layer: 'raw-bytes' | 'structured-input'; data: string | Uint8Array }>,
): Promise<EvidenceRecord> {
  const layers: string[] = [];
  for (const x of provenanceInputs) {
    const text = typeof x.data === 'string' ? x.data : String.fromCharCode(...x.data);
    layers.push(`${x.layer}:${await sha256hex(text)}`);
  }
  const evidenceId = `ev-poolstate-${++seq}-${await sha256hex(layers.join('|') + seq)}`.slice(0, 48);
  const record: EvidenceRecord = {
    evidenceId,
    contractVersion: EVIDENCE_CONTRACT_VERSION,
    cap: 'CAP-02-CHAIN',
    source: RESERVE_ADAPTER_SOURCE,
    adapter: RESERVE_ADAPTER_ID,
    sourceVersion: RESERVE_ADAPTER_VERSION,
    entityType: 'pool',
    entityId: `${base.venue}:${base.poolAddress}`,
    factType: 'pool-state',
    value: { venue: base.venue, slot: base.contextSlot, ...value },
    observedAt: base.observedAt,
    slot: base.contextSlot,
    txSignatures: [],
    confidence: null,
    provenance: {
      method: 'decode:pool-account-layout',
      rawRef: layers.join('|'),
    },
  };
  assertEvidence(record);
  return record;
}

/** Raydium v4/CPMM: reserves from jsonParsed vault token accounts; fees deferred. */
export async function buildRaydiumPoolState(input: RaydiumAdapterInput): Promise<EvidenceRecord> {
  const value: Record<string, unknown> = {
    mint: input.mint,
    poolAddress: input.poolAddress,
    feesResolved: false, // fee extraction deferred: pool-account layout pending on-chain verification
    feeFields: null,
  };
  // Mint-match check (Design B-1): requested mint must be one of the vault mints,
  // else the whole fact is rejected — never recorded with a wrong-side guess.
  const mints = [input.vaultQuote?.mint, input.vaultBase?.mint];
  if (!mints.includes(input.mint)) {
    throw new Error(`pool-state: requested mint ${input.mint} matches neither vault (${mints.join(',')}) — fact rejected`);
  }
  if (input.vaultQuote) value.reserveQuote = input.vaultQuote.amount;
  if (input.vaultBase) value.reserveBase = input.vaultBase.amount;

  const provenance: Array<{ layer: 'raw-bytes' | 'structured-input'; data: string | Uint8Array }> = [];
  if (input.poolAccountBytes) provenance.push({ layer: 'raw-bytes', data: input.poolAccountBytes });
  if (input.vaultQuote || input.vaultBase) {
    provenance.push({ layer: 'structured-input', data: JSON.stringify({ q: input.vaultQuote, b: input.vaultBase }) });
  }
  return emit(
    { mint: input.mint, poolAddress: input.poolAddress, venue: input.venue, observedAt: input.observedAt, contextSlot: input.contextSlot },
    value,
    provenance,
  );
}

function readU64LE(bytes: Uint8Array, offset: number): string {
  let hex = '';
  for (let i = 7; i >= 0; i--) hex += bytes[offset + i].toString(16).padStart(2, '0');
  return BigInt('0x' + hex).toString();
}

/** pump.fun bonding curve: virtual AND real reserves coexist (DQ-1 OPEN — no collapsing). */
export async function buildPumpCurvePoolState(input: PumpAdapterInput): Promise<EvidenceRecord> {
  const L = PUMP_CURVE_LAYOUT;
  const bytes = input.curveAccountBytes;
  const minLen = L.completeFlagByte + 1;
  if (bytes.length < minLen) {
    throw new Error(`pool-state: curve account too short (${bytes.length} < ${minLen}) — fact rejected`);
  }
  const value: Record<string, unknown> = {
    mint: input.mint,
    poolAddress: input.poolAddress,
    virtualTokenReserves: readU64LE(bytes, L.discriminator + 0),
    virtualSolReserves: readU64LE(bytes, L.discriminator + 8),
    realTokenReserves: readU64LE(bytes, L.discriminator + 16),
    realSolReserves: readU64LE(bytes, L.discriminator + 24),
    tokenTotalSupply: readU64LE(bytes, L.discriminator + 32),
    complete: bytes[L.completeFlagByte] === 1,
    feesResolved: true, // bonding-curve fee is a program constant recorded as curve semantics, not an extractable fee field
    feeFields: { model: 'pump.fun-bonding-curve' },
  };
  return emit(
    { mint: input.mint, poolAddress: input.poolAddress, venue: 'pump.fun-curve', observedAt: input.observedAt, contextSlot: input.contextSlot },
    value,
    [{ layer: 'raw-bytes', data: bytes }],
  );
}

/** Fixture byte builder for pump.fun curve accounts (tests only). */
export function fixtureCurveAccountBytes(opts?: {
  virtualToken?: bigint; virtualSol?: bigint; realToken?: bigint; realSol?: bigint;
  supply?: bigint; complete?: boolean;
}): Uint8Array {
  const L = PUMP_CURVE_LAYOUT;
  const out = new Uint8Array(L.completeFlagByte + 1);
  const view = new DataView(out.buffer);
  view.setBigUint64(L.discriminator + 0, opts?.virtualToken ?? 1_000_000_000_000n, true);
  view.setBigUint64(L.discriminator + 8, opts?.virtualSol ?? 30_000_000_000n, true);
  view.setBigUint64(L.discriminator + 16, opts?.realToken ?? 793_000_000_000n, true);
  view.setBigUint64(L.discriminator + 24, opts?.realSol ?? 25_000_000_000n, true);
  view.setBigUint64(L.discriminator + 32, opts?.supply ?? 1_000_000_000_000n, true);
  out[L.completeFlagByte] = opts?.complete ? 1 : 0;
  return out;
}
