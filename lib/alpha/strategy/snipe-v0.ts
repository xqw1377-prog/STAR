import type { NewPoolBirth, PoolBookSnapshot } from '@/lib/alpha/recorder/types';
import { PORTFOLIO_POLICY_V0 } from '@/lib/alpha/account/policy';
import type { ExitPlan } from '@/lib/alpha/exit/types';
import { decideLaunch, type CoreSkip } from '@/lib/alpha/core/decide';
import type { MarketPolicy } from '@/lib/alpha/core/types';
import { activeAdapter } from '@/lib/alpha/markets/registry';
import type { MarketAdapter } from '@/lib/alpha/markets/contract';

export const SNIPE_STRATEGY_ID = 'snipe-value-meme@v0' as const;

/** 运行时选中的 U-01 实例视图。原生名称来自 active adapter，不是 Core。 */
const active = activeAdapter();

/** U-01 实例的运行策略快照（由当前选定 adapter 的 policy 派生，不绑定具体链）。 */
export const SNIPE_V0 = {
  id: SNIPE_STRATEGY_ID,
  universe: active.policy.instance,
  universeClass: active.info.class,
  dexes: active.policy.venues,
  quotes: active.policy.quotes,
  minReserveSolEq: active.policy.minReserve,
  exitReserveSolEq: active.policy.exitReserve,
  maxHoldSlots: active.policy.maxHoldClocks,
  maxPositions: PORTFOLIO_POLICY_V0.maxPositions,
  maxNameWeight: PORTFOLIO_POLICY_V0.maxNameWeight,
} as const;

export type SnipeSkip = Exclude<CoreSkip, 'NO_CLOCK' | 'VENUE_NOT_IN_UNIVERSE'> | 'DEX_NOT_IN_UNIVERSE';

export interface OpenPosition {
  mint: string;
  entrySlot: number;
  notionalUsdc: number;
  exitPlan?: ExitPlan;
}

function toSkip(reason: CoreSkip): SnipeSkip {
  if (reason === 'VENUE_NOT_IN_UNIVERSE') return 'DEX_NOT_IN_UNIVERSE';
  if (reason === 'NO_CLOCK') return 'DEX_NOT_IN_UNIVERSE';
  return reason;
}

export function shouldEnter(
  birth: NewPoolBirth,
  book: PoolBookSnapshot | undefined,
  open: OpenPosition[],
  adapter: MarketAdapter,
): { enter: true; notionalUsdc: number } | { enter: false; reason: SnipeSkip } {
  const event = adapter.toLaunchEvent(birth);
  const fact = book ? adapter.toBookFact(book) : undefined;
  const verdict = decideLaunch(event, fact, open, adapter.policy);
  if (!verdict.enter) return { enter: false, reason: toSkip(verdict.reason) };
  return verdict;
}

export type ExitReason = 'EXIT_IMPOSSIBLE' | 'LIQUIDITY_COLLAPSE' | 'MAX_HOLD' | 'HOLD';

export function shouldExit(
  position: OpenPosition,
  book: PoolBookSnapshot | undefined,
  nowSlot: number,
  impossible: boolean,
  policy: MarketPolicy,
): ExitReason {
  if (impossible) return 'EXIT_IMPOSSIBLE';
  if (!book || book.quoteReserveSol < policy.exitReserve) return 'LIQUIDITY_COLLAPSE';
  if (nowSlot - position.entrySlot >= policy.maxHoldClocks) return 'MAX_HOLD';
  return 'HOLD';
}
