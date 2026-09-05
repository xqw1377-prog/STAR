/**
 * STAR Core. Chain-agnostic. Adapters translate native venues into these facts.
 * Venue and execution vendor names belong in Market Adapters, not here.
 */

export const UNIVERSE_CLASS = 'U-01' as const;
export const UNIVERSE_CLASS_NAME = 'Early On-chain Launch Market' as const;

export type UniverseInstanceId = 'U-01-SOLANA' | 'U-01-BNB' | 'U-01-BTC' | 'U-01-BASE' | 'U-01-TON';

export interface LaunchEvent {
  universe: UniverseInstanceId;
  assetId: string;
  venue: string;
  quote: string;
  initialReserve: number;
  reserveUnit: string;
  observedAt: string;
  clock: number | null;
}

export interface BookFact {
  assetId: string;
  quoteReserve: number;
  clock: number;
}

export interface MarketPolicy {
  instance: UniverseInstanceId;
  venues: readonly string[];
  quotes: readonly string[];
  minReserve: number;
  exitReserve: number;
  maxHoldClocks: number;
  reserveUnit: string;
}

export interface MarketAdapterInfo {
  instance: UniverseInstanceId;
  class: typeof UNIVERSE_CLASS;
  className: typeof UNIVERSE_CLASS_NAME;
  discoveryProvider: string;
  truthProvider: string;
  executionProvider: string;
  selected: boolean;
}
