/**
 * Provider selection. The only registry-ENABLED source is the synthetic
 * fixture. 'solana-rpc' is chosen only when the registry marks it ENABLED —
 * there is no environment-variable override anywhere (DATA-006).
 */
import { CONTRACT_VERSION, type ReadonlyChainProvider } from './contract';
import { createSolanaRpcProvider } from './solana-rpc';
import { createFixtureProvider } from './fixture-provider';
import { SOURCE_REGISTRY } from './source-registry';

export type ProviderKind = 'fixture' | 'solana-rpc';

function rpcEnabled(): boolean {
  return SOURCE_REGISTRY['solana-rpc']?.status === 'ENABLED';
}

export function providerKind(): ProviderKind {
  return process.env.STAR_DATA_PROVIDER === 'solana-rpc' && rpcEnabled()
    ? 'solana-rpc'
    : 'fixture';
}

export function createProvider(projectId: string): ReadonlyChainProvider {
  return providerKind() === 'solana-rpc'
    ? createSolanaRpcProvider()
    : createFixtureProvider(projectId);
}

export function providerStatus() {
  return {
    kind: providerKind(),
    contractVersion: CONTRACT_VERSION,
    registry: SOURCE_REGISTRY,
    rpcUrl: process.env.STAR_RPC_URL || 'https://api.mainnet-beta.solana.com',
    readOnly: true,
    wallet: false,
    trading: false,
  };
}
