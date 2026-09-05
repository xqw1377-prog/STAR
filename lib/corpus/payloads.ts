const PK = '11111111111111111111111111111111';

export function tokenClean() {
  return {
    decimals: 6,
    supply: '1000000000',
    mintAuthority: null as string | null,
    freezeAuthority: null as string | null,
    transferHook: null as string | null,
    permanentDelegate: null as string | null,
    feeConfig: null as string | null,
    token2022Extensions: [] as string[],
  };
}

export function tokenMintLive() {
  return { ...tokenClean(), mintAuthority: 'Deployer1111111111111111111111112' };
}

export function tokenFreezeLive() {
  return { ...tokenClean(), freezeAuthority: 'Freezer11111111111111111111111113' };
}

export function tokenUnresolved() {
  return { ...tokenClean(), token2022Extensions: null as string[] | null };
}

export function sellOk() {
  return {
    method: 'fixture' as const,
    inputAmount: '1000000',
    outAmount: '900000',
    priceImpactPct: 0.01,
    buy: { outAmount: '1000000', priceImpactPct: 0.01 },
    detail: 'ok',
  };
}

export function sellBlocked() {
  return { ...sellOk(), detail: 'honeypot' };
}

export function sellNoImpact() {
  return { ...sellOk(), priceImpactPct: null as number | null };
}

export function liqOk(tvl = 400000) {
  return {
    tvlUsdTotal: tvl,
    exitDepthUsd: 80000,
    pools: [{
      dex: 'raydium',
      pairAddress: PK,
      pair: 'TKN/SOL',
      tvlUsd: tvl,
      lpMint: PK,
      lpBurnedPct: 1,
      lockedUntil: null as string | null,
    }],
  };
}

export function liqThin() {
  return liqOk(20_000);
}

export function liqNoLock() {
  return {
    tvlUsdTotal: 400000,
    exitDepthUsd: 80000,
    pools: [{
      dex: 'raydium',
      pairAddress: PK,
      pair: 'TKN/SOL',
      tvlUsd: 400000,
      lpMint: PK,
      lpBurnedPct: null as number | null,
      lockedUntil: null as string | null,
    }],
  };
}

export function liqShallowExit() {
  return { ...liqOk(400000), exitDepthUsd: 5_000 };
}

export function holdersOk(adj = 0.22) {
  return { supply: '1000', topAccounts: [] as { address: string; amount: string; pctOfSupply: number }[], top10Pct: 0.2, top10PctEntityAdjusted: adj };
}

export function holdersConc() {
  return holdersOk(0.7);
}

export function holdersNoAdj() {
  return { ...holdersOk(), top10PctEntityAdjusted: null as number | null };
}

export function relatedOk(cluster = 0.1) {
  return { clusterPct: cluster, wallets: [] as { address: string; label: string; entity: string; pctOfSupply: number }[], attributionConfidence: 0.9, graphIngested: true };
}

export function relatedHot() {
  return relatedOk(0.4);
}

export function relatedNoGraph() {
  return { ...relatedOk(), graphIngested: false };
}

export function progOk() {
  return { programId: PK, owner: PK, upgradeAuthority: null as string | null, immutable: true, verifiedBuild: true, accountParsed: true };
}

export function progUpgrade() {
  return { ...progOk(), verifiedBuild: false, immutable: false, upgradeAuthority: PK };
}

export function progUnparsed() {
  return { ...progOk(), accountParsed: false, verifiedBuild: null as boolean | null };
}
