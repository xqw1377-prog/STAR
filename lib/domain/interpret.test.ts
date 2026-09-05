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
  it('does not let a tiny locked pool endorse aggregate TVL', () => {
    const r = interpretCheck('liquidity', {
      tvlUsdTotal: 400000,
      exitDepthUsd: 80000,
      pools: [
        { tvlUsd: 5000, lockedUntil: '2028-01-01' },
        { tvlUsd: 395000, lockedUntil: null, lpBurnedPct: 0 },
      ],
    });
    expect(r.status).toBe('FAIL');
  });
  it('treats expired lockedUntil as unlocked', () => {
    const r = interpretCheck('liquidity', {
      tvlUsdTotal: 200000,
      exitDepthUsd: 80000,
      pools: [{ tvlUsd: 200000, lockedUntil: '2020-01-01', lpBurnedPct: 0 }],
    }, { asOf: new Date('2026-09-02T00:00:00Z') });
    expect(r.status).toBe('UNKNOWN');
  });
});

describe('interpretCheck — tradability impact', () => {
  it('F2-A interregnum: UNKNOWN regardless of raw impact — E-01 interpreter not authorized', () => {
    expect(interpretCheck('sell-simulation', { priceImpactPct: 0.01, buy: { priceImpactPct: 0.01 } }).status).toBe('UNKNOWN');
    expect(interpretCheck('sell-simulation', { priceImpactPct: 0.4, buy: { priceImpactPct: 0.4 } }).status).toBe('UNKNOWN');
  });
});

describe('interpretCheck — related wallets require graph', () => {
  it('UNKNOWN without graphIngested even if clusterPct is low', () => {
    const r = interpretCheck('related-wallets', { clusterPct: 0.1, wallets: [] });
    expect(r.status).toBe('UNKNOWN');
    expect(r.claim).toMatch(/WALLET_GRAPH_MISSING/);
  });
});

describe('interpretCheck — program proof', () => {
  it('UNKNOWN when immutable lacks verified build/owner', () => {
    expect(interpretCheck('program-verification', { immutable: true, verifiedBuild: null, owner: null }).status).toBe('UNKNOWN');
  });
  it('UNKNOWN when account is malformed', () => {
    expect(interpretCheck('program-verification', { accountParsed: false, immutable: true }).status).toBe('UNKNOWN');
  });
});
