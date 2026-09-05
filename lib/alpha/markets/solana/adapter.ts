import type { NewPoolBirth, PoolBookSnapshot } from '@/lib/alpha/recorder/types';
import type { BookFact, LaunchEvent, MarketPolicy } from '@/lib/alpha/core/types';
import { UNIVERSE_CLASS, UNIVERSE_CLASS_NAME } from '@/lib/alpha/core/types';
import type { MarketAdapter } from '@/lib/alpha/markets/contract';

/** Frozen U-01 instance. Native names stay here, not in Core. */
export const SOLANA_U01_POLICY: MarketPolicy = {
  instance: 'U-01-SOLANA',
  venues: ['pump.fun-bonding-curve', 'raydium-amm-v4', 'raydium-cpmm'],
  quotes: ['SOL', 'USDC'],
  minReserve: 8,
  exitReserve: 1,
  maxHoldClocks: 1800,
  reserveUnit: 'SOL-eq',
};

export const solanaLaunchAdapter: MarketAdapter = {
  info: {
    instance: 'U-01-SOLANA',
    class: UNIVERSE_CLASS,
    className: UNIVERSE_CLASS_NAME,
    discoveryProvider: 'ave.ai',
    truthProvider: 'solana-rpc-geyser',
    executionProvider: 'jupiter-ultra',
    selected: true,
  },
  policy: SOLANA_U01_POLICY,
  toLaunchEvent(raw: unknown): LaunchEvent {
    const birth = raw as NewPoolBirth;
    return {
      universe: 'U-01-SOLANA',
      assetId: birth.mint,
      venue: birth.dex,
      quote: birth.quoteAsset,
      initialReserve: birth.initialReserveSolEq,
      reserveUnit: SOLANA_U01_POLICY.reserveUnit,
      observedAt: birth.observedAt,
      clock: birth.slot,
    };
  },
  toBookFact(raw: unknown): BookFact {
    const book = raw as PoolBookSnapshot;
    return {
      assetId: book.mint,
      quoteReserve: book.quoteReserveSol,
      clock: book.slot,
    };
  },
};
