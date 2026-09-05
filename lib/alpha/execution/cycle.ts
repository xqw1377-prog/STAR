import { lockDecisionIntent, type LockedDecisionIntent } from '@/lib/alpha/account/intent';
import type { NewPoolBirth, PoolBookSnapshot, ExecutionLabel } from '@/lib/alpha/recorder/types';
import { shouldEnter, shouldExit, type OpenPosition, type ExitReason } from '@/lib/alpha/strategy/snipe-v0';
import { executeLockedIntent, type FillResult } from './fill';

export interface CycleInput {
  births: NewPoolBirth[];
  books: PoolBookSnapshot[];
  open: OpenPosition[];
  decisionSlot: number;
  impossibleMints?: string[];
  env?: NodeJS.Dict<string>;
}

export interface CycleTrade {
  mint: string;
  side: 'BUY' | 'SELL';
  intent?: LockedDecisionIntent;
  fill?: FillResult;
  skip?: string;
  exitReason?: ExitReason;
  label?: ExecutionLabel;
}

/** One automatic cycle: entries then exits. No wallet. */
export function runSnipeCycle(input: CycleInput): CycleTrade[] {
  const trades: CycleTrade[] = [];
  const open = [...input.open];
  const bookOf = (mint: string) => input.books.find((b) => b.mint === mint && b.slot <= input.decisionSlot);

  for (const birth of input.births) {
    if (birth.slot == null) {
      trades.push({ mint: birth.mint, side: 'BUY', skip: 'NO_SLOT' });
      continue;
    }
    const book = bookOf(birth.mint);
    const verdict = shouldEnter(birth, book, open);
    if (!verdict.enter) {
      trades.push({ mint: birth.mint, side: 'BUY', skip: verdict.reason });
      continue;
    }
    try {
      const intent = lockDecisionIntent({
        mint: birth.mint,
        side: 'BUY',
        maxNotionalUsdc: verdict.notionalUsdc,
        signalSlot: birth.slot,
        decisionSlot: input.decisionSlot,
        hasPointInTimeBook: true,
      });
      const fill = executeLockedIntent(intent, input.env);
      trades.push({ mint: birth.mint, side: 'BUY', intent, fill, label: fill.label });
      if (fill.label === 'FILL_OK') {
        open.push({ mint: birth.mint, entrySlot: intent.executableSlot, notionalUsdc: fill.filledNotionalUsdc });
      }
    } catch (e) {
      trades.push({ mint: birth.mint, side: 'BUY', skip: e instanceof Error ? e.message : 'lock-failed' });
    }
  }

  for (const pos of [...open]) {
    const reason = shouldExit(
      pos,
      bookOf(pos.mint),
      input.decisionSlot,
      Boolean(input.impossibleMints?.includes(pos.mint)),
    );
    if (reason === 'HOLD') continue;
    if (reason === 'EXIT_IMPOSSIBLE') {
      trades.push({ mint: pos.mint, side: 'SELL', exitReason: reason, label: 'EXIT_IMPOSSIBLE' });
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
      const fill = executeLockedIntent(intent, input.env);
      trades.push({
        mint: pos.mint,
        side: 'SELL',
        intent,
        fill,
        exitReason: reason,
        label: fill.label === 'FILL_OK' ? 'FILL_OK' : 'SELL_FAIL',
      });
    } catch {
      trades.push({
        mint: pos.mint,
        side: 'SELL',
        exitReason: reason,
        label: 'NO_POINT_IN_TIME_BOOK',
      });
    }
  }

  return trades;
}
