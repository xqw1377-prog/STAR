/**
 * Code-level mirror of docs/p0-data/SOURCE_LICENSE_MATRIX.md.
 *
 * A real (non-fixture) adapter cannot even be constructed unless its source
 * is ENABLED here (P1 acceptance DATA-006). There is NO runtime override:
 * engineering smoke tests import the separate smoke-only factory in
 * lib/data/solana-rpc-smoke.ts, which is unreachable from any app/runtime
 * module graph and therefore absent from production builds.
 */

export type SourceStatus =
  | 'ENABLED'
  | 'BLOCKED_PROVIDER_SELECTION'
  | 'BLOCKED_VENDOR_SELECTION'
  | 'BLOCKED'
  | 'LEGAL_REVIEW_REQUIRED'
  | 'REVIEW_REQUIRED'
  | 'MANUAL_ONLY';

export interface SourceEntry {
  status: SourceStatus;
  note: string;
}

export const SOURCE_REGISTRY: Record<string, SourceEntry> = {
  'synthetic-fixtures': { status: 'ENABLED', note: 'Synthetic Solana history; only enabled source' },
  'solana-rpc': { status: 'ENABLED', note: 'Helius mainnet RPC (principal-provided key 2026-09-05); read-only' },
  'jupiter-api': { status: 'LEGAL_REVIEW_REQUIRED', note: 'API terms and quotas not frozen' },
  'jupiter-ultra': { status: 'LEGAL_REVIEW_REQUIRED', note: 'Solana instance execution hand; not STAR Core; /execute locked' },
  'ave-ai': { status: 'LEGAL_REVIEW_REQUIRED', note: 'Discovery only; never a Decision; storage/replay terms not approved' },
  'dexscreener-api': { status: 'LEGAL_REVIEW_REQUIRED', note: 'Not in approved registry' },
  'raydium-api': { status: 'LEGAL_REVIEW_REQUIRED', note: 'Reuse/retention terms not approved' },
  'github-api': { status: 'LEGAL_REVIEW_REQUIRED', note: 'API terms and repo licenses apply' },
  social: { status: 'BLOCKED', note: 'No connector until compliance decision' },
};

export class SourceNotEnabledError extends Error {
  constructor(readonly source: string, readonly entry: SourceEntry) {
    super(`source '${source}' is ${entry.status}: ${entry.note}`);
  }
}

/**
 * Throws SourceNotEnabledError unless the source is ENABLED. No environment
 * variable, flag, or parameter can bypass this — by design.
 */
export function assertSourceEnabled(source: string): void {
  const entry = SOURCE_REGISTRY[source];
  if (!entry) throw new SourceNotEnabledError(source, { status: 'BLOCKED', note: 'unknown source' });
  if (entry.status !== 'ENABLED') {
    throw new SourceNotEnabledError(source, entry);
  }
}
