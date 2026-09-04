/**
 * U-04 coverage: Recorder mints ∩ second-replay mints / second-replay mints.
 * Second replay unavailable → not measurable → M1-EVIDENCE cannot pass.
 * This is a pure function. It does not enable a live source.
 */

export interface CoverageResult {
  measurable: boolean;
  coverage: number | null;
  missing: string[];
  reason: string;
}

export function coverageAgainstSecondReplay(
  recorderMints: readonly string[],
  replayMints: readonly string[],
): CoverageResult {
  if (replayMints.length === 0) {
    return {
      measurable: false,
      coverage: null,
      missing: [],
      reason: 'U-04: second replay unavailable → M1-EVIDENCE cannot pass',
    };
  }
  const have = new Set(recorderMints);
  const missing = replayMints.filter((mint) => !have.has(mint));
  const coverage = (replayMints.length - missing.length) / replayMints.length;
  return {
    measurable: true,
    coverage,
    missing,
    reason: coverage >= 0.95 ? 'meets 95% floor' : 'below 95% floor',
  };
}
