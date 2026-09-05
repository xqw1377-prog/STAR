import { lockDecisionIntent, type LockedDecisionIntent } from '@/lib/alpha/account/intent';
import type { NewPoolBirth, PoolBookSnapshot, ExecutionLabel } from '@/lib/alpha/recorder/types';
import type { OpenPosition } from '@/lib/alpha/strategy/snipe-v0';
import { decideEnter, type EntryThesis } from '@/lib/alpha/decision/engine';
import { decideExit, type ExitThesis } from '@/lib/alpha/exit/engine';
import type { ExitKind } from '@/lib/alpha/exit/types';
import { executeLockedIntent, type FillResult } from './fill';
import { jupiterExecute, jupiterOrder, type UltraOrder } from './jupiter-ultra';
import type { Candidate } from '@/lib/alpha/discovery/types';

export interface CycleInput {
  births: NewPoolBirth[];
  books: PoolBookSnapshot[];
  open: OpenPosition[];
  decisionSlot: number;
  impossibleMints?: string[];
  candidates?: Candidate[];
  env?: NodeJS.Dict<string>;
}

export interface CycleTrade {
  mint: string;
  side: 'BUY' | 'SELL';
  intent?: LockedDecisionIntent;
  fill?: FillResult;
  skip?: string;
  exitReason?: ExitKind;
  entryThesis?: EntryThesis;
  exitThesis?: ExitThesis;
  ultraOrder?: UltraOrder;
  label?: ExecutionLabel;
}

/** Detect → Verify → Decide → Enter → Monitor → Exit. Jupiter never decides. */
export function runSnipeCycle(input: CycleInput): CycleTrade[] {
  const trades: CycleTrade[] = [];
  const open = [...input.open];
  const bookOf = (mint: string) => input.books.find((b) => b.mint === mint && b.slot <= input.decisionSlot);
  const candidateOf = (mint: string) => input.candidates?.find((c) => c.mint === mint);

  for (const birth of input.births) {
    const book = bookOf(birth.mint);
    const verdict = decideEnter(birth, book, open, candidateOf(birth.mint));
    if (verdict.decide === 'SKIP') {
      trades.push({ mint: birth.mint, side: 'BUY', skip: verdict.reason, entryThesis: verdict.thesis });
      continue;
    }
    if (birth.slot == null) {
      trades.push({ mint: birth.mint, side: 'BUY', skip: 'NO_SLOT', entryThesis: verdict.thesis });
      continue;
    }
    try {
      const intent = lockDecisionIntent({
        mint: birth.mint,
        side: 'BUY',
        maxNotionalUsdc: verdict.thesis.notionalUsdc,
        signalSlot: birth.slot,
        decisionSlot: input.decisionSlot,
        hasPointInTimeBook: true,
      });
      const ultraOrder = jupiterOrder(intent);
      const locked = jupiterExecute(ultraOrder, input.env);
      if (locked.reason !== 'EXECUTE_FEATURE_LOCKED' && locked.label === 'EXECUTION_FAILURE') {
        trades.push({ mint: birth.mint, side: 'BUY', intent, ultraOrder, label: locked.label, skip: locked.reason, entryThesis: verdict.thesis });
        continue;
      }
      const fill = executeLockedIntent(intent, input.env);
      trades.push({ mint: birth.mint, side: 'BUY', intent, fill, ultraOrder, label: fill.label, entryThesis: verdict.thesis });
      if (fill.label === 'FILL_OK') {
        open.push({
          mint: birth.mint,
          entrySlot: intent.executableSlot,
          notionalUsdc: fill.filledNotionalUsdc,
          exitPlan: verdict.thesis.exitPlan,
        });
      }
    } catch (e) {
      trades.push({ mint: birth.mint, side: 'BUY', skip: e instanceof Error ? e.message : 'lock-failed', entryThesis: verdict.thesis });
    }
  }

  for (const pos of [...open]) {
    const thesis = decideExit(
      pos,
      bookOf(pos.mint),
      input.decisionSlot,
      Boolean(input.impossibleMints?.includes(pos.mint)),
    );
    if (thesis.action === 'HOLD') continue;
    if (thesis.kind === 'EXIT_IMPOSSIBLE') {
      trades.push({ mint: pos.mint, side: 'SELL', exitReason: thesis.kind, exitThesis: thesis, label: 'EXIT_IMPOSSIBLE' });
      continue;
    }
    const book = bookOf(pos.mint);
    try {
      const intent = lockDecisionIntent({
        mint: pos.mint,
        side: 'SELL',
        maxNotionalUsdc: pos.notionalUsdc,
        signalSlot: input.decisionSlot,
        decisionSlot: input.decisionSlot,
        hasPointInTimeBook: Boolean(book),
      });
      const ultraOrder = jupiterOrder(intent);
      const fill = executeLockedIntent(intent, input.env);
      trades.push({
        mint: pos.mint,
        side: 'SELL',
        intent,
        fill,
        ultraOrder,
        exitReason: thesis.kind,
        exitThesis: thesis,
        label: fill.label === 'FILL_OK' ? 'FILL_OK' : 'SELL_FAIL',
      });
    } catch {
      trades.push({
        mint: pos.mint,
        side: 'SELL',
        exitReason: thesis.kind,
        exitThesis: thesis,
        label: 'NO_POINT_IN_TIME_BOOK',
      });
    }
  }

  return trades;
}
