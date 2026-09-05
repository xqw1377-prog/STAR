import { assertSourceEnabled, SourceNotEnabledError } from '@/lib/data/source-registry';
import type { LockedDecisionIntent } from '@/lib/alpha/account/intent';
import type { ExecutionLabel } from '@/lib/alpha/recorder/types';

export const JUPITER_ULTRA_BASE = 'https://api.jup.ag/swap/v2';

export interface UltraOrder {
  requestId: string;
  outAmount: string;
  transaction: string | null;
  router: 'fixture-sim' | 'ultra';
  mode: 'quote-only' | 'ready-to-sign';
}

export interface UltraExecuteResult {
  label: ExecutionLabel;
  reason: string;
}

/**
 * Hands only. Never scans mints. Never decides ENTER.
 * Network /order is refused until `jupiter-ultra` is ENABLED.
 * /execute needs four locks at once.
 */
export function jupiterOrder(intent: LockedDecisionIntent): UltraOrder {
  try {
    assertSourceEnabled('jupiter-ultra');
  } catch (e) {
    if (!(e instanceof SourceNotEnabledError)) throw e;
    return {
      requestId: `dry-${intent.mint.slice(0, 8)}-${intent.executableSlot}`,
      outAmount: String(intent.maxNotionalUsdc),
      transaction: null,
      router: 'fixture-sim',
      mode: 'quote-only',
    };
  }
  throw new Error('jupiter-ultra live /order not wired');
}

export function jupiterExecuteAllowed(env: NodeJS.Dict<string> = process.env): boolean {
  try {
    assertSourceEnabled('jupiter-ultra');
  } catch {
    return false;
  }
  return (
    env.STAR_MICRO_LIVE === '1' &&
    env.STAR_JUPITER_EXECUTE === '1' &&
    Boolean(env.STAR_WALLET_KEYPAIR)
  );
}

export function jupiterExecute(_order: UltraOrder, env?: NodeJS.Dict<string>): UltraExecuteResult {
  if (!jupiterExecuteAllowed(env)) {
    return { label: 'EXECUTION_FAILURE', reason: 'EXECUTE_FEATURE_LOCKED' };
  }
  return { label: 'EXECUTION_FAILURE', reason: 'WALLET_ADAPTER_NOT_WIRED' };
}
