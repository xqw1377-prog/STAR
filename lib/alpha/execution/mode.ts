export type ExecutionMode = 'DRY_RUN' | 'BROADCAST';

/**
 * Broadcast only when the principal explicitly arms live mode AND a wallet
 * is configured in the environment. Keys never come from the repo.
 */
export function resolveExecutionMode(env: NodeJS.Dict<string> = process.env): ExecutionMode {
  if (env.STAR_MICRO_LIVE === '1' && Boolean(env.STAR_WALLET_KEYPAIR)) return 'BROADCAST';
  return 'DRY_RUN';
}
