import { describe, expect, it } from 'vitest';
import { interpretCheck } from './interpret';

describe('interpretCheck — token privileges', () => {
  it('FAIL when transfer hook is present even if mint/freeze are empty', () => {
    const r = interpretCheck('mint-authority', {
      mintAuthority: null,
      freezeAuthority: null,
      transferHook: 'hook-1',
      permanentDelegate: null,
      feeConfig: null,
      token2022Extensions: [],
    });
    expect(r.status).toBe('FAIL');
  });

  it('FAIL when mint is live even if extensions are unresolved', () => {
    const r = interpretCheck('mint-authority', { mintAuthority: 'deployer', freezeAuthority: null });
    expect(r.status).toBe('FAIL');
  });

  it('UNKNOWN when Token-2022 extensions are not resolved', () => {
    const r = interpretCheck('mint-authority', { mintAuthority: null, freezeAuthority: null });
    expect(r.status).toBe('UNKNOWN');
  });
});

describe('interpretCheck — holders', () => {
  it('UNKNOWN when only address-level top10 exists', () => {
    const r = interpretCheck('holder-distribution', { top10Pct: 0.2 });
    expect(r.status).toBe('UNKNOWN');
    expect(r.claim).toMatch(/Entity-adjusted/);
  });

  it('PASS only with entity-adjusted share inside threshold', () => {
    expect(interpretCheck('holder-distribution', { top10Pct: 0.2, top10PctEntityAdjusted: 0.31 }).status).toBe('PASS');
    expect(interpretCheck('holder-distribution', { top10Pct: 0.2, top10PctEntityAdjusted: 0.5 }).status).toBe('FAIL');
  });
});

describe('interpretCheck — liquidity exit depth', () => {
  const burned = {
    tvlUsdTotal: 200000,
    pools: [{ lpBurnedPct: 0.85, lockedUntil: null }],
  };
  it('UNKNOWN when TVL and burn exist but exit depth is missing', () => {
    expect(interpretCheck('liquidity', burned).status).toBe('UNKNOWN');
  });
  it('PASS when lock/burn and exit depth are both observed', () => {
    expect(interpretCheck('liquidity', { ...burned, exitDepthUsd: 80000 }).status).toBe('PASS');
  });
});
