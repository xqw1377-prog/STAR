import type { NewPoolBirth, PoolBookSnapshot } from '@/lib/alpha/recorder/types';
import { PORTFOLIO_POLICY_V0, maxNameNotionalUsdc } from '@/lib/alpha/account/policy';

export const SNIPE_STRATEGY_ID = 'snipe-value-meme@v0' as const;

/** Explicit entry/exit. Not the six research gates. */
export const SNIPE_V0 = {
  id: SNIPE_STRATEGY_ID,
  dexes: ['pump.fun-bonding-curve', 'raydium-amm-v4', 'raydium-cpmm'] as const,
  quotes: ['SOL', 'USDC'] as const,
  minReserveSolEq: 8,
  exitReserveSolEq: 1,
  maxHoldSlots: 1800,
  maxPositions: PORTFOLIO_POLICY_V0.maxPositions,
  maxNameWeight: PORTFOLIO_POLICY_V0.maxNameWeight,
} as const;

export type SnipeSkip =
  | 'DEX_NOT_IN_UNIVERSE'
  | 'QUOTE_NOT_ALLOWED'
  | 'RESERVE_BELOW_MIN'
  | 'ALREADY_IN_POSITION'
  | 'MAX_POSITIONS'
  | 'NO_BOOK';

export interface OpenPosition {
  mint: string;
  entrySlot: number;
  notionalUsdc: number;
}

export function shouldEnter(
  birth: NewPoolBirth,
  book: PoolBookSnapshot | undefined,
  open: OpenPosition[],
): { enter: true; notionalUsdc: number } | { enter: false; reason: SnipeSkip } {
  if (!SNIPE_V0.dexes.includes(birth.dex)) return { enter: false, reason: 'DEX_NOT_IN_UNIVERSE' };
  if (!SNIPE_V0.quotes.includes(birth.quoteAsset)) return { enter: false, reason: 'QUOTE_NOT_ALLOWED' };
  if (birth.initialReserveSolEq < SNIPE_V0.minReserveSolEq) return { enter: false, reason: 'RESERVE_BELOW_MIN' };
  if (!book) return { enter: false, reason: 'NO_BOOK' };
  if (open.some((p) => p.mint === birth.mint)) return { enter: false, reason: 'ALREADY_IN_POSITION' };
  if (open.length >= SNIPE_V0.maxPositions) return { enter: false, reason: 'MAX_POSITIONS' };
  return { enter: true, notionalUsdc: maxNameNotionalUsdc(PORTFOLIO_POLICY_V0.initialNavUsdc) };
}

export type ExitReason = 'EXIT_IMPOSSIBLE' | 'LIQUIDITY_COLLAPSE' | 'MAX_HOLD' | 'HOLD';

export function shouldExit(
  position: OpenPosition,
  book: PoolBookSnapshot | undefined,
  nowSlot: number,
  impossible: boolean,
): ExitReason {
  if (impossible) return 'EXIT_IMPOSSIBLE';
  if (!book || book.quoteReserveSol < SNIPE_V0.exitReserveSolEq) return 'LIQUIDITY_COLLAPSE';
  if (nowSlot - position.entrySlot >= SNIPE_V0.maxHoldSlots) return 'MAX_HOLD';
  return 'HOLD';
}
