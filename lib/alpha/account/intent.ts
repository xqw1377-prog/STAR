import { maxNameNotionalUsdc, PORTFOLIO_POLICY_V0 } from './policy';
import type { ExecutionLabel } from '@/lib/alpha/recorder/types';

export const EXECUTABLE_SLOT_LAG = 2;

export type DecisionSide = 'BUY' | 'SELL';

export interface DecisionIntentDraft {
  mint: string;
  side: DecisionSide;
  maxNotionalUsdc: number;
  signalSlot: number | null;
  decisionSlot: number | null;
  hasPointInTimeBook: boolean;
  navUsdc?: number;
}

export interface LockedDecisionIntent {
  mint: string;
  side: DecisionSide;
  maxNotionalUsdc: number;
  executableSlot: number;
  locked: true;
  label: Extract<ExecutionLabel, 'NO_POINT_IN_TIME_BOOK'> | null;
}

export class IntentRejected extends Error {
  constructor(
    readonly label: ExecutionLabel,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Lock a DecisionIntent. No wallet, no broadcast.
 * Missing book → NO_POINT_IN_TIME_BOOK (E-04). Oversize → reject, not clip.
 */
export function lockDecisionIntent(draft: DecisionIntentDraft): LockedDecisionIntent {
  const nav = draft.navUsdc ?? PORTFOLIO_POLICY_V0.initialNavUsdc;
  if (draft.maxNotionalUsdc > maxNameNotionalUsdc(nav)) {
    throw new IntentRejected('EXECUTION_FAILURE', 'notional exceeds 0.5% NAV');
  }
  if (draft.signalSlot == null || draft.decisionSlot == null) {
    throw new IntentRejected('EXECUTION_FAILURE', 'signal_slot and decision_slot required');
  }
  if (!draft.hasPointInTimeBook) {
    throw new IntentRejected('NO_POINT_IN_TIME_BOOK', 'no point-in-time book');
  }
  return {
    mint: draft.mint,
    side: draft.side,
    maxNotionalUsdc: draft.maxNotionalUsdc,
    executableSlot: Math.max(draft.signalSlot, draft.decisionSlot) + EXECUTABLE_SLOT_LAG,
    locked: true,
    label: null,
  };
}
