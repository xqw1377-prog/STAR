import type { PoolBookSnapshot } from '@/lib/alpha/recorder/types';
import type { OpenPosition } from '@/lib/alpha/strategy/snipe-v0';
import { SNIPE_V0 } from '@/lib/alpha/strategy/snipe-v0';
import { thesisBroken, type ThesisLive } from '@/lib/alpha/core/thesis';
import type { ExitKind, ExitPlan } from './types';

export type { ExitKind, ExitPlan };

export interface ExitThesis {
  mint: string;
  action: 'HOLD' | 'EXIT';
  kind: ExitKind;
  why: string[];
}

export interface Mark {
  /** Unrealized pnl in bps vs entry notional. Null = no mark, TP/SL/trailing stay dark. */
  pnlBps: number | null;
}

/**
 * Recompute the live thesis. Missing mark does not invent TP/SL.
 * Liquidity / time / impossible still fire from chain facts.
 */
export function decideExit(
  position: OpenPosition,
  book: PoolBookSnapshot | undefined,
  nowSlot: number,
  impossible: boolean,
  mark?: Mark,
  live?: ThesisLive,
): ExitThesis {
  const plan: ExitPlan = position.exitPlan ?? {
    liquidityFloorSol: SNIPE_V0.exitReserveSolEq,
    maxHoldSlots: SNIPE_V0.maxHoldSlots,
    takeProfitBps: null,
    stopLossBps: null,
    trailingBps: null,
  };
  if (impossible) {
    return { mint: position.mint, action: 'EXIT', kind: 'EXIT_IMPOSSIBLE', why: ['delist or freeze first seen'] };
  }
  if (live) {
    const broken = thesisBroken(live);
    if (broken.length) {
      return { mint: position.mint, action: 'EXIT', kind: 'THESIS_BROKEN', why: broken };
    }
  }
  if (!book || book.quoteReserveSol < plan.liquidityFloorSol) {
    return { mint: position.mint, action: 'EXIT', kind: 'LIQUIDITY_EXIT', why: ['reserve below exit floor'] };
  }
  if (nowSlot - position.entrySlot >= plan.maxHoldSlots) {
    return { mint: position.mint, action: 'EXIT', kind: 'TIME_EXIT', why: [`held >= ${plan.maxHoldSlots} slots`] };
  }
  if (mark?.pnlBps != null && plan.takeProfitBps != null && mark.pnlBps >= plan.takeProfitBps) {
    return { mint: position.mint, action: 'EXIT', kind: 'TAKE_PROFIT', why: [`pnl ${mark.pnlBps} >= tp ${plan.takeProfitBps}`] };
  }
  if (mark?.pnlBps != null && plan.stopLossBps != null && mark.pnlBps <= -plan.stopLossBps) {
    return { mint: position.mint, action: 'EXIT', kind: 'STOP_LOSS', why: [`pnl ${mark.pnlBps} <= -sl ${plan.stopLossBps}`] };
  }
  return { mint: position.mint, action: 'HOLD', kind: 'HOLD', why: ['thesis intact'] };
}
