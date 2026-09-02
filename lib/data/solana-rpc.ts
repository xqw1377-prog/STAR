/**
 * Guarded RPC provider factory — the ONLY entry point reachable from app
 * code. Constructing an unauthorized source throws (DATA-006); there is no
 * runtime override.
 */
import { assertSourceEnabled } from './source-registry';
import { createSolanaRpcProviderCore } from './solana-rpc-core';
import type { ReadonlyChainProvider } from './contract';

export function createSolanaRpcProvider(): ReadonlyChainProvider {
  assertSourceEnabled('solana-rpc');
  return createSolanaRpcProviderCore();
}
