import { assertSourceEnabled, SourceNotEnabledError } from '@/lib/data/source-registry';
import { FIXTURE_NEW_POOLS } from '@/lib/alpha/recorder/fixture-universe';
import type { Candidate } from './types';

/**
 * Ave.ai is the eye. It never returns ENTER.
 * Live HTTP is refused until the license matrix ENABLES `ave-ai`.
 */
export function discoverCandidates(): Candidate[] {
  try {
    assertSourceEnabled('ave-ai');
  } catch (e) {
    if (!(e instanceof SourceNotEnabledError)) throw e;
    return FIXTURE_NEW_POOLS.map((p) => ({
      mint: p.mint,
      source: 'synthetic-fixtures',
      observedAt: p.observedAt,
      hints: { liquidity: p.initialReserveSolEq >= 8 },
    }));
  }
  throw new Error('ave-ai live adapter not wired');
}
