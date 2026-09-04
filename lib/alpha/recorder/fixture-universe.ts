import type { NewPoolBirth } from './types';

/**
 * Synthetic discovery set for M1-BUILD tests.
 * Not historical corpus. REAL DATA remains NO-EVIDENCE until M1-EVIDENCE.
 */
export const FIXTURE_NEW_POOLS: Array<Omit<NewPoolBirth, 'receiptId'>> = [
  {
    mint: 'PumpMint111111111111111111111111111111111',
    dex: 'pump.fun-bonding-curve',
    quoteAsset: 'SOL',
    poolAddress: 'PumpPool11111111111111111111111111111111',
    initialReserveSolEq: 12,
    observedAt: '2026-09-04T00:00:00.000Z',
    effectiveAt: '2026-09-04T00:00:00.000Z',
    slot: 1001,
    source: 'fixture',
  },
  {
    mint: 'AmmMint1111111111111111111111111111111111',
    dex: 'raydium-amm-v4',
    quoteAsset: 'SOL',
    poolAddress: 'AmmPool111111111111111111111111111111111',
    initialReserveSolEq: 40,
    observedAt: '2026-09-04T00:01:00.000Z',
    effectiveAt: '2026-09-04T00:01:00.000Z',
    slot: 1061,
    source: 'fixture',
  },
  {
    mint: 'CpmmMint111111111111111111111111111111111',
    dex: 'raydium-cpmm',
    quoteAsset: 'USDC',
    poolAddress: 'CpmmPool11111111111111111111111111111111',
    initialReserveSolEq: 9,
    observedAt: '2026-09-04T00:02:00.000Z',
    effectiveAt: '2026-09-04T00:02:00.000Z',
    slot: 1121,
    source: 'fixture',
  },
];
