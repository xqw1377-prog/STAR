/**
 * M1 Recorder — fact recording ONLY (M0 FROZEN rev1, issued 2026-09-05).
 * Constraints (unchanged from the issuance ruling): this module records facts.
 * It MUST NOT generate strategy signals, optimize parameters, or connect wallets.
 * Facts land on the D1 append-only ledger (collection_attempt → outcome →
 * receipt → normalized_fact) via lib/data/ledger.ts.
 */

export const RECORDER_VERSION = 'm1-recorder@1';

/** New pool birth observation (U-03: graduation = same mint, keyed by mint). */
export interface NewPoolBirth {
  mint: string;
  dex: 'pump.fun-bonding-curve' | 'raydium-amm-v4' | 'raydium-cpmm';
  quoteAsset: 'SOL' | 'USDC';
  poolAddress: string;
  /** Initial observable reserve in SOL-equivalent (U-01: ≥ 8 SOL enters discovery denominator). */
  initialReserveSolEq: number;
  observedAt: string; // ISO UTC
  effectiveAt: string;
  slot: number | null;
  source: 'fixture' | 'solana-program-log';
  /** Raw lineage back to the D1 receipt that carried this observation. */
  receiptId: string;
}

/** Point-in-time pool book snapshot (E-03: on-chain curve state at slot). */
export interface PoolBookSnapshot {
  mint: string;
  poolAddress: string;
  quoteReserveSol: number;
  baseReserveRaw: string;
  slot: number;
  observedAt: string;
  source: 'fixture' | 'solana-program-log';
  receiptId: string;
}

/** Priority fee observation (E-02: p75 over N=150 slots computed downstream). */
export interface PriorityFeeObservation {
  slot: number;
  /** lamports per CU or per-signature as reported by source; version-tagged. */
  feeLamports: number;
  feeMetric: 'per-cu' | 'per-signature';
  observedAt: string;
  source: 'fixture' | 'rpc-getBlockFee';
  receiptId: string;
}

/** Execution outcome mapping to the frozen E-05 closed taxonomy. */
export type ExecutionLabel =
  | 'BUY_FAIL'
  | 'PARTIAL_FILL'
  | 'SELL_FAIL'
  | 'EXIT_IMPOSSIBLE'
  | 'NO_POINT_IN_TIME_BOOK'
  | 'EXECUTION_FAILURE'
  | 'FILL_OK';
