import type { CoverageReport } from './types';

/**
 * U-04: independent index is the denominator.
 * Missing independent data → coverage = null → M1-EVIDENCE cannot pass.
 */
export function coverageAgainstIndependent(recorderMints: string[], independentMints: string[]): CoverageReport {
  const rec = new Set(recorderMints);
  const missed = independentMints.filter((m) => !rec.has(m));
  if (independentMints.length === 0) {
    return {
      recorderMints,
      independentMints,
      hit: 0,
      missed: [],
      coverage: null,
      evidenceReady: false,
    };
  }
  const hit = independentMints.length - missed.length;
  return {
    recorderMints,
    independentMints,
    hit,
    missed,
    coverage: hit / independentMints.length,
    evidenceReady: false,
  };
}
