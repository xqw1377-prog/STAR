import type { NewPoolBirth } from './types';

/**
 * Synthetic discovery set for M1-BUILD tests.
 * Not historical corpus. REAL DATA remains NO-EVIDENCE until M1-EVIDENCE.
 */
export const FIXTURE_NEW_POOLS: NewPoolBirth[] = [
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
    rawReceipt: { program: 'pump.fun', ix: 'create', slot: 1001 },
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
    rawReceipt: { program: 'raydium-amm-v4', ix: 'initialize2', slot: 1061 },
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
    rawReceipt: { program: 'raydium-cpmm', ix: 'initialize', slot: 1121 },
  },
];

/** Same three program IDs / slot window, plus one birth the recorder did not see. */
export const FIXTURE_INDEPENDENT_INDEX: string[] = [
  ...FIXTURE_NEW_POOLS.map((p) => p.mint),
  'MissedMint1111111111111111111111111111111',
];

export const FIXTURE_POOL_BOOKS = FIXTURE_NEW_POOLS.map((p) => ({
  mint: p.mint,
  poolAddress: p.poolAddress,
  quoteReserve: p.initialReserveSolEq,
  baseReserve: 1_000_000,
  observedAt: p.observedAt,
  effectiveAt: p.effectiveAt,
  slot: p.slot,
  source: p.source,
  rawReceipt: { kind: 'book', slot: p.slot },
}));
