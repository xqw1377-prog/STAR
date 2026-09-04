export const SUPPORTED_DEXES = [
  'pump.fun-bonding-curve',
  'raydium-amm-v4',
  'raydium-cpmm',
] as const;

export type SupportedDex = (typeof SUPPORTED_DEXES)[number];

export const QUOTE_ASSETS = ['SOL', 'USDC'] as const;
export type QuoteAsset = (typeof QUOTE_ASSETS)[number];

export interface NewPoolBirth {
  mint: string;
  dex: SupportedDex;
  quoteAsset: QuoteAsset;
  poolAddress: string;
  initialReserveSolEq: number;
  observedAt: string;
  effectiveAt: string;
  slot: number | null;
  source: 'fixture' | 'solana-program-log';
  rawReceipt: unknown;
}

export interface PoolBookSnapshot {
  mint: string;
  poolAddress: string;
  quoteReserve: number;
  baseReserve: number;
  observedAt: string;
  effectiveAt: string;
  slot: number | null;
  source: 'fixture' | 'solana-program-log';
  rawReceipt: unknown;
}

export interface RecordOutcome {
  mint: string;
  attemptId: string;
  ok: boolean;
  outcome: 'SUCCESS' | 'SOURCE_ERROR' | 'TRANSPORT_ERROR' | 'TIMEOUT' | 'ABORTED' | 'PARTIAL';
  detail: string;
  collectorVersion: string;
}

export interface CoverageReport {
  recorderMints: string[];
  independentMints: string[];
  hit: number;
  missed: string[];
  coverage: number | null;
  evidenceReady: false;
}

export interface LatencyReport {
  n: number;
  p50Ms: number | null;
  p95Ms: number | null;
  liveOnly: true;
}
