import type { NewPoolBirth, PoolBookSnapshot } from '@/lib/alpha/recorder/types';
import { shouldEnter, SNIPE_V0, type OpenPosition, type SnipeSkip } from '@/lib/alpha/strategy/snipe-v0';
import { activeAdapter } from '@/lib/alpha/markets/registry';
import type { Candidate } from '@/lib/alpha/discovery/types';
import type { ExitPlan } from '@/lib/alpha/exit/types';

export type WindowState = 'OPEN' | 'CLOSED';
export type SkipReason = SnipeSkip | 'NO_SLOT';

export interface EntryThesis {
  mint: string;
  window: WindowState;
  notionalUsdc: number;
  why: string[];
  exitPlan: ExitPlan;
}

export type EnterVerdict =
  | { decide: 'ENTER'; thesis: EntryThesis }
  | { decide: 'SKIP'; reason: SkipReason; thesis: EntryThesis };

export function defaultExitPlan(): ExitPlan {
  return {
    liquidityFloorSol: SNIPE_V0.exitReserveSolEq,
    maxHoldSlots: SNIPE_V0.maxHoldSlots,
    takeProfitBps: null,
    stopLossBps: null,
    trailingBps: null,
  };
}

function skip(mint: string, reason: SkipReason, why: string[]): EnterVerdict {
  return {
    decide: 'SKIP',
    reason,
    thesis: { mint, window: 'CLOSED', notionalUsdc: 0, why, exitPlan: defaultExitPlan() },
  };
}

/** Candidate hints never flip ENTER by themselves. */
export function decideEnter(
  birth: NewPoolBirth,
  book: PoolBookSnapshot | undefined,
  open: OpenPosition[],
  candidate?: Candidate,
): EnterVerdict {
  if (birth.slot == null) return skip(birth.mint, 'NO_SLOT', ['no signal slot']);

  const rule = shouldEnter(birth, book, open, activeAdapter());
  if (!rule.enter) {
    const why = [`snipe-v0:${rule.reason}`];
    if (candidate) why.unshift('candidate is not a decision');
    return skip(birth.mint, rule.reason, why);
  }

  const why = [
    `universe:${SNIPE_V0.universe}`,
    `venue:${birth.dex}`,
    `quote:${birth.quoteAsset}`,
    `reserve>=${SNIPE_V0.minReserveSolEq}`,
    'point-in-time-book',
  ];
  if (candidate) why.push(`discovered-by:${candidate.source}`);

  return {
    decide: 'ENTER',
    thesis: {
      mint: birth.mint,
      window: 'OPEN',
      notionalUsdc: rule.notionalUsdc,
      why,
      exitPlan: defaultExitPlan(),
    },
  };
}
