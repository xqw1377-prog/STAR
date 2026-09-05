import { solanaLaunchAdapter } from './solana/adapter';
import type { MarketAdapter } from './contract';

export type RadarHeat = 'SELECTED' | 'NOT-INSTANCED';

/** Runtime selects one instance. Architecture lists others without adapters. */
export const MARKET_RADAR = {
  class: 'U-01',
  className: 'Early On-chain Launch Market',
  selected: 'U-01-SOLANA',
  boards: {
    'U-01-SOLANA': { heat: 'SELECTED' as RadarHeat, adapter: true },
    'U-01-BNB': { heat: 'NOT-INSTANCED' as RadarHeat, adapter: false },
    'U-01-BTC': { heat: 'NOT-INSTANCED' as RadarHeat, adapter: false },
    'U-01-BASE': { heat: 'NOT-INSTANCED' as RadarHeat, adapter: false },
    'U-01-TON': { heat: 'NOT-INSTANCED' as RadarHeat, adapter: false },
  },
} as const;

export function activeAdapter(): MarketAdapter {
  return solanaLaunchAdapter;
}

export function assertOnlySelectedInstance(id: string): void {
  if (id !== MARKET_RADAR.selected) {
    throw new Error(`universe ${id} is not selected; runtime is locked to ${MARKET_RADAR.selected}`);
  }
}
