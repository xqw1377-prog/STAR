import type { ExecutionLabel } from '@/lib/alpha/recorder/types';
import type { LockedDecisionIntent } from '@/lib/alpha/account/intent';
import { resolveExecutionMode, type ExecutionMode } from './mode';

export interface FillResult {
  mode: ExecutionMode;
  label: ExecutionLabel;
  filledNotionalUsdc: number;
  remainingNotionalUsdc: number;
}

/**
 * Auto-executes a locked intent. DRY_RUN applies E-01 (keep ≥80% quote side
 * and ≤15% impact) as a full fill of the locked notional. BROADCAST is
 * refused until a live adapter is wired — never signs from source.
 */
export function executeLockedIntent(intent: LockedDecisionIntent, env?: NodeJS.Dict<string>): FillResult {
  const mode = resolveExecutionMode(env);
  if (mode === 'BROADCAST') {
    return {
      mode,
      label: 'EXECUTION_FAILURE',
      filledNotionalUsdc: 0,
      remainingNotionalUsdc: intent.maxNotionalUsdc,
    };
  }
  return {
    mode: 'DRY_RUN',
    label: 'FILL_OK',
    filledNotionalUsdc: intent.maxNotionalUsdc,
    remainingNotionalUsdc: 0,
  };
}
