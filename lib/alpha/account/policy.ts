/** Frozen PortfolioPolicy v0 — numbers from contract B1.1 / P-04. Not a fund authorization. */

export const PORTFOLIO_POLICY_ID = 'portfolio-policy@v0-rev1' as const;

export const PORTFOLIO_POLICY_V0 = {
  id: PORTFOLIO_POLICY_ID,
  reportingCurrency: 'USDC',
  auxBenchmark: 'SOL',
  btcBenchmark: 'BTC',
  initialNavUsdc: 100_000,
  leverage: 0,
  maxNameWeight: 0.005,
  maxPositions: 5,
  sameMintPositions: 1,
  cashYield: 0,
  dailyNavCutoffUtc: '00:00',
  cashOnlyUsdc: true,
} as const;

export function maxNameNotionalUsdc(navUsdc: number): number {
  return navUsdc * PORTFOLIO_POLICY_V0.maxNameWeight;
}

export function maxTotalExposureUsdc(navUsdc: number, cashUsdc: number): number {
  const named = PORTFOLIO_POLICY_V0.maxPositions * maxNameNotionalUsdc(navUsdc);
  return Math.min(named, cashUsdc);
}
