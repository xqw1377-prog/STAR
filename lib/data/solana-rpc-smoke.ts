/**
 * ENGINEERING SMOKE ONLY — never import from app/runtime code.
 *
 * Serves the live read-only smoke test (rpc-smoke.test.ts) while sources are
 * pending license review. Reachability contract: this module appears ONLY in
 * the test module graph; the frozen-candidate verification greps the
 * production build output for this file's marker string and must find zero
 * occurrences, proving physical isolation from the production runtime.
 */
import { createSolanaRpcProviderCore } from './solana-rpc-core';
import type { ReadonlyChainProvider } from './contract';

export const SMOKE_ONLY_MARKER = 'solana-rpc-smoke-module';

export function createSolanaRpcProviderForEngineeringSmoke(): ReadonlyChainProvider {
  return createSolanaRpcProviderCore();
}
