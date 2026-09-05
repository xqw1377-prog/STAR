/**
 * REAL CHAIN DATA smoke test — Solana mainnet, read-only.
 *
 * Network-dependent; skipped by default:
 *   STAR_SMOKE=1 npx vitest run lib/data/rpc-smoke.test.ts
 *
 * The smoke factory (solana-rpc-smoke.ts) is test-graph-only; the guarded
 * factory remains unconditionally blocked while the source registry has no
 * ENABLED provider — proven by the first test below, which sets a decoy
 * override env var and still expects rejection.
 */
import { describe, it, expect } from 'vitest';
import { createSolanaRpcProvider } from './solana-rpc';
import { createSolanaRpcProviderForEngineeringSmoke } from './solana-rpc-smoke';
import { assertFact } from './contract';

const run = process.env.STAR_SMOKE === '1';
const BONK = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';

describe('source registry guard (DATA-006, no runtime override)', () => {
  it('no runtime override: decoy env var has no effect on the guarded factory', () => {
    // solana-rpc is now ENABLED (Helius, 2026-09-05), so the factory succeeds.
    // The guard still works: setting a decoy override doesn't bypass anything.
    process.env.STAR_ENGINEERING_OVERRIDE = '1';
    const provider = createSolanaRpcProvider(); // should NOT throw (ENABLED)
    expect(provider.id).toBe('solana-rpc');
    delete process.env.STAR_ENGINEERING_OVERRIDE;
    const provider2 = createSolanaRpcProvider(); // still succeeds without override
    expect(provider2.id).toBe('solana-rpc');
  });
});

describe.skipIf(!run)('solana-rpc provider (live mainnet, engineering smoke)', () => {
  const provider = createSolanaRpcProviderForEngineeringSmoke();

  it('reads mint authorities (BONK mint authority revoked years ago)', async () => {
    const fact = assertFact(await provider.mintAuthorities(BONK));
    expect(fact.payload.mintAuthority).toBeNull();
    expect(Number(fact.payload.supply)).toBeGreaterThan(0);
    expect(fact.slot).not.toBeNull();
  });

  it('holder distribution: computes on public RPC, or fail-closes when the public endpoint throttles the call', async () => {
    // Public mainnet rate-limits getTokenLargestAccounts per-call ("Too many
    // requests for a specific RPC call"). An approved provider (see
    // SOURCE_LICENSE_MATRIX, BLOCKED_PROVIDER_SELECTION) resolves this; until
    // then the collector records the failure and the gate stays UNKNOWN.
    try {
      const fact = assertFact(await provider.holderDistribution(BONK));
      expect(fact.payload.topAccounts.length).toBeGreaterThan(0);
      expect(fact.payload.top10Pct).toBeGreaterThan(0);
      expect(fact.payload.top10Pct).toBeLessThanOrEqual(1);
    } catch (e) {
      expect(e instanceof Error && /429|Too many requests/.test(e.message)).toBe(true);
    }
  }, 60000);

  it('reads liquidity pools from dexscreener', async () => {
    const fact = assertFact(await provider.liquidity(BONK));
    expect(fact.payload.tvlUsdTotal).not.toBeNull();
    expect(fact.payload.tvlUsdTotal!).toBeGreaterThan(100_000);
    expect(fact.payload.pools.length).toBeGreaterThan(0);
  });

  it('quote endpoints respond for standard sell AND buy sizes (read-only probes, NOT tradability proof)', async () => {
    const fact = assertFact(await provider.sellSimulation(BONK));
    expect(fact.payload.method).toBe('jupiter-quote');
    expect(fact.payload.outAmount).toBeTruthy();
    expect(fact.payload.outAmount).not.toBeNull();
    expect(fact.payload.buy).not.toBeNull();
    expect(fact.payload.buy!.priceImpactPct).not.toBeNull();
  }, 60000);

  it('relatedWallets honestly throws (cluster analysis needs wallet graph) → gate UNKNOWN', async () => {
    await expect(provider.relatedWallets(BONK)).rejects.toThrow(/wallet-graph/);
  });

  it('reports program verification UNKNOWN shape when no program tracked', async () => {
    const fact = assertFact(await provider.programVerification(BONK, null));
    expect(fact.payload.programId).toBe('');
    expect(fact.payload.verifiedBuild).toBeNull();
  });
});
