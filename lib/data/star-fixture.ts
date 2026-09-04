/**
 * Synthetic Solana history fixture.
 *
 * A time-layered stream of ChainFacts per project. Older facts reflect riskier
 * early state (authorities live, thin liquidity, concentrated holders); facts
 * improve as the fictional project matures. The fixture is what makes Replay
 * Lab meaningful: evaluating at different asOf instants flips gates.
 *
 * Nothing here touches the network. Mints are fixture-only base58 strings.
 */
import type { ChainFact, FactKind } from './contract';

export const FIXTURE_SOURCE = 'fixture';
const CONTRACT = 'solana-readonly@3';

export interface FixtureProject {
  projectId: string;
  name: string;
  symbol: string;
  mint: string;
  programId: string | null;
  narrativeId: string;
  lifecycle: 'SEED' | 'IGNITION' | 'VERIFIED' | 'ACCELERATION' | 'CROWDING' | 'DISTRIBUTION' | 'DEAD';
  website: string | null;
  github: string | null;
  twitter: string | null;
}

export const FIXTURE_PROJECTS: FixtureProject[] = [
  {
    projectId: 'proj-neural', name: 'Neural Swarm', symbol: 'NSWARM',
    mint: 'nswarm11111111111111111111111111', programId: 'ProgNs...1111',
    narrativeId: 'ai-agent', lifecycle: 'VERIFIED',
    website: 'https://neural-swarm.dev', github: 'https://github.com/neural-swarm', twitter: 'https://x.com/neural_swarm',
  },
  {
    projectId: 'proj-llm-lab', name: 'LLM Lab', symbol: 'LLML',
    mint: 'llml2222222222222222222222222222', programId: 'ProgLL...2222',
    narrativeId: 'ai-agent', lifecycle: 'IGNITION',
    website: 'https://llm-lab.ai', github: 'https://github.com/llm-lab', twitter: 'https://x.com/llm_lab',
  },
  {
    projectId: 'proj-rocket', name: 'Rocket Moon', symbol: 'RCKT',
    mint: 'rckt3333333333333333333333333333', programId: 'ProgRc...3333',
    narrativeId: 'meme-2', lifecycle: 'CROWDING',
    website: 'https://rocket-moon.meme', github: null, twitter: 'https://x.com/rocket_moon',
  },
  {
    projectId: 'proj-honeypot', name: 'SafeMoon Yield', symbol: 'SMY',
    mint: 'smy44444444444444444444444444444', programId: 'ProgSM...4444',
    narrativeId: 'meme-2', lifecycle: 'IGNITION',
    website: 'https://safemoon-yield.io', github: null, twitter: null,
  },
];

const ISO = (d: Date) => d.toISOString();
const dayAgo = (now: Date, n: number) => new Date(now.getTime() - n * 86400000);

type FactRow<K extends FactKind> = Omit<ChainFact<K>, 'contractVersion' | 'chainId' | 'mint' | 'source' | 'sourceUrl' | 'observedAt'> & {
  observedAt: Date;
};

const TOKEN_RESOLVED = {
  transferHook: null as string | null,
  permanentDelegate: null as string | null,
  feeConfig: null as string | null,
  token2022Extensions: [] as string[],
};

function mintPay(
  decimals: number,
  supply: string,
  auth: string | null,
  extra: Record<string, unknown> = {},
) {
  return {
    decimals,
    supply,
    mintAuthority: auth,
    freezeAuthority: auth,
    ...TOKEN_RESOLVED,
    ...extra,
  };
}

function holdersPay(
  supply: string,
  top10Pct: number,
  topAccounts: { address: string; amount: string; pctOfSupply: number }[],
) {
  return { supply, top10Pct, top10PctEntityAdjusted: top10Pct, topAccounts };
}

function fact<K extends FactKind>(
  project: FixtureProject,
  row: FactRow<K>,
  sourceUrl: string | null = null,
): ChainFact<K> {
  return {
    ...row,
    contractVersion: CONTRACT,
    chainId: 'solana',
    mint: project.mint,
    source: FIXTURE_SOURCE,
    sourceUrl,
    observedAt: ISO(row.observedAt),
  } as ChainFact<K>;
}

/**
 * Full fact timeline across all fixture projects, anchored at `now`.
 * ingestedAt = observedAt + 1h (STAR learned each fact an hour after it
 * existed on-chain), which satisfies the temporal invariant.
 */
export function fixtureTimeline(now: Date): { projectId: string; fact: ChainFact }[] {
  const out: { projectId: string; fact: ChainFact }[] = [];
  const push = (projectId: string, f: ChainFact) => out.push({ projectId, fact: f });
  const slot = (n: number) => 300_000_000 + n;

  const neural = FIXTURE_PROJECTS[0];
  const N = (t: number, i = 0) => ({ observedAt: dayAgo(now, t), slot: slot(i) });

  push('proj-neural', fact(neural, {
    ...N(18, 1), kind: 'mint-authority',
    payload: mintPay(9, '1000000000000000000', 'nswarmDeployer1111111111111111111'),
  }));
  push('proj-neural', fact(neural, {
    ...N(18, 1), kind: 'freeze-authority',
    payload: mintPay(9, '1000000000000000000', 'nswarmDeployer1111111111111111111'),
  }));
  push('proj-neural', fact(neural, {
    ...N(17, 2), kind: 'holder-distribution',
    payload: holdersPay('1000000000000000000', 0.72, [{ address: 'nswarmDeployer1111111111111111111', amount: '520000000000000000', pctOfSupply: 0.52 }]),
  }));
  push('proj-neural', fact(neural, {
    ...N(17, 3), kind: 'liquidity',
    payload: { pools: [{ dex: 'Raydium', pairAddress: 'p00lnsw1111111111111111111111111111', pair: 'NSWARM/SOL', tvlUsd: 22000, lpMint: 'lpnsw111111111111111111111111111', lpBurnedPct: null, lockedUntil: null }], tvlUsdTotal: 22000, exitDepthUsd: null },
  }));
  push('proj-neural', fact(neural, {
    ...N(15, 4), kind: 'mint-authority',
    payload: mintPay(9, '1000000000000000000', null),
  }));
  push('proj-neural', fact(neural, {
    ...N(15, 4), kind: 'freeze-authority',
    payload: mintPay(9, '1000000000000000000', null),
  }));
  push('proj-neural', fact(neural, {
    ...N(13, 5), kind: 'liquidity',
    payload: { pools: [{ dex: 'Raydium', pairAddress: 'p00lnsw1111111111111111111111111111', pair: 'NSWARM/SOL', tvlUsd: 160000, lpMint: 'lpnsw111111111111111111111111111', lpBurnedPct: 0.85, lockedUntil: null }], tvlUsdTotal: 160000, exitDepthUsd: 80000 },
  }));
  push('proj-neural', fact(neural, {
    ...N(13, 6), kind: 'holder-distribution',
    payload: holdersPay('1000000000000000000', 0.41, [{ address: 'nswarmTeamVest11111111111111111111', amount: '180000000000000000', pctOfSupply: 0.18 }]),
  }));
  push('proj-neural', fact(neural, {
    ...N(11, 7), kind: 'sell-simulation',
    payload: { executable: true, method: 'fixture', inputAmount: '10000000000000000', outAmount: '1500000000', priceImpactPct: 0.012, buy: { executable: true, outAmount: '9900000000000000', priceImpactPct: 0.014 }, detail: 'Sell+buy routes exist via Raydium, impact 1.2%/1.4%' },
  }));
  push('proj-neural', fact(neural, {
    ...N(11, 8), kind: 'program-verification',
    payload: { programId: neural.programId!, owner: 'BPFLoaderUpgradeab1e11111111111111111111111', upgradeAuthority: 'nswarmMultisig111111111111111111111', immutable: false, verifiedBuild: true },
  }));
  push('proj-neural', fact(neural, {
    ...N(9, 11), kind: 'related-wallets',
    payload: { graphIngested: true, clusterPct: 0.12, wallets: [{ address: 'nswarmTeamVest11111111111111111111', label: 'team vesting', entity: 'Neural Swarm Team', pctOfSupply: 0.09 }, { address: 'nswarmMm111111111111111111111111111', label: 'market maker', entity: 'MM A', pctOfSupply: 0.03 }], attributionConfidence: 0.9 },
  }));
  push('proj-neural', fact(neural, {
    ...N(9, 9), kind: 'holder-distribution',
    payload: holdersPay('1000000000000000000', 0.27, [{ address: 'nswarmTeamVest11111111111111111111', amount: '90000000000000000', pctOfSupply: 0.09 }]),
  }));
  push('proj-neural', fact(neural, {
    ...N(9, 10), kind: 'liquidity',
    payload: { pools: [{ dex: 'Raydium', pairAddress: 'p00lnsw1111111111111111111111111111', pair: 'NSWARM/SOL', tvlUsd: 850000, lpMint: 'lpnsw111111111111111111111111111', lpBurnedPct: 0.85, lockedUntil: null }], tvlUsdTotal: 850000, exitDepthUsd: 120000 },
  }));

  const llml = FIXTURE_PROJECTS[1];
  const L = (t: number, i = 0) => ({ observedAt: dayAgo(now, t), slot: slot(i) });
  push('proj-llm-lab', fact(llml, {
    ...L(14, 20), kind: 'mint-authority',
    payload: mintPay(9, '500000000000000000', null),
  }));
  push('proj-llm-lab', fact(llml, {
    ...L(14, 20), kind: 'freeze-authority',
    payload: mintPay(9, '500000000000000000', null),
  }));
  push('proj-llm-lab', fact(llml, {
    ...L(13, 21), kind: 'liquidity',
    payload: { pools: [{ dex: 'Orca', pairAddress: 'p00llml1111111111111111111111111111', pair: 'LLML/SOL', tvlUsd: 320000, lpMint: 'lpllml111111111111111111111111111', lpBurnedPct: null, lockedUntil: '2027-03-01' }], tvlUsdTotal: 320000, exitDepthUsd: 50000 },
  }));
  push('proj-llm-lab', fact(llml, {
    ...L(12, 22), kind: 'holder-distribution',
    payload: holdersPay('500000000000000000', 0.31, [{ address: 'llmlTeam111111111111111111111111111', amount: '70000000000000000', pctOfSupply: 0.14 }]),
  }));
  push('proj-llm-lab', fact(llml, {
    ...L(11, 23), kind: 'sell-simulation',
    payload: { executable: true, method: 'fixture', inputAmount: '5000000000000000', outAmount: '820000000', priceImpactPct: 0.031, buy: { executable: true, outAmount: '4940000000000000', priceImpactPct: 0.028 }, detail: 'Sell+buy routes exist via Orca, impact 3.1%/2.8%' },
  }));
  push('proj-llm-lab', fact(llml, {
    ...L(10, 25), kind: 'related-wallets',
    payload: { graphIngested: true, clusterPct: 0.55, wallets: [{ address: 'llmlTeam111111111111111111111111111', label: 'team', entity: 'LLM Lab Team', pctOfSupply: 0.22 }, { address: 'llmlDevVest1111111111111111111111111', label: 'dev vesting', entity: 'LLM Lab Team', pctOfSupply: 0.18 }, { address: 'llmlMm1111111111111111111111111111', label: 'market maker', entity: 'MM B', pctOfSupply: 0.15 }], attributionConfidence: 0.82 },
  }));
  push('proj-llm-lab', fact(llml, {
    ...L(10, 24), kind: 'program-verification',
    payload: { programId: llml.programId!, owner: 'BPFLoaderUpgradeab1e11111111111111111111111', upgradeAuthority: 'llmlDevWallet11111111111111111111111', immutable: false, verifiedBuild: null },
  }));

  const rckt = FIXTURE_PROJECTS[2];
  const R = (t: number, i = 0) => ({ observedAt: dayAgo(now, t), slot: slot(i) });
  push('proj-rocket', fact(rckt, {
    ...R(10, 30), kind: 'mint-authority',
    payload: mintPay(6, '1000000000000000', 'rcktOwner11111111111111111111111111', { transferHook: 'rckt-hook' }),
  }));
  push('proj-rocket', fact(rckt, {
    ...R(10, 30), kind: 'freeze-authority',
    payload: mintPay(6, '1000000000000000', 'rcktOwner11111111111111111111111111', { transferHook: 'rckt-hook' }),
  }));
  push('proj-rocket', fact(rckt, {
    ...R(9, 31), kind: 'liquidity',
    payload: { pools: [{ dex: 'Raydium', pairAddress: 'p00lrckt111111111111111111111111111', pair: 'RCKT/SOL', tvlUsd: 2100000, lpMint: 'lprckt111111111111111111111111111', lpBurnedPct: 0.05, lockedUntil: null }], tvlUsdTotal: 2100000, exitDepthUsd: null },
  }));
  push('proj-rocket', fact(rckt, {
    ...R(9, 32), kind: 'holder-distribution',
    payload: holdersPay('1000000000000000', 0.62, [{ address: 'rcktOwner11111111111111111111111111', amount: '450000000000000', pctOfSupply: 0.45 }]),
  }));
  push('proj-rocket', fact(rckt, {
    ...R(8, 33), kind: 'sell-simulation',
    payload: { executable: true, method: 'fixture', inputAmount: '10000000000000', outAmount: '21000000000', priceImpactPct: 0.021, buy: { executable: true, outAmount: '9800000000000', priceImpactPct: 0.018 }, detail: 'Sell+buy routes exist, impact 2.1%/1.8%' },
  }));
  push('proj-rocket', fact(rckt, {
    ...R(8, 35), kind: 'related-wallets',
    payload: { graphIngested: true, clusterPct: 0.45, wallets: [{ address: 'rcktOwner11111111111111111111111111', label: 'owner', entity: 'Rocket Owner', pctOfSupply: 0.45 }], attributionConfidence: 0.88 },
  }));
  push('proj-rocket', fact(rckt, {
    ...R(8, 34), kind: 'program-verification',
    payload: { programId: rckt.programId!, owner: 'BPFLoaderUpgradeab1e11111111111111111111111', upgradeAuthority: 'rcktOwner11111111111111111111111111', immutable: false, verifiedBuild: null },
  }));

  const smy = FIXTURE_PROJECTS[3];
  const S = (t: number, i = 0) => ({ observedAt: dayAgo(now, t), slot: slot(i) });
  push('proj-honeypot', fact(smy, {
    ...S(8, 40), kind: 'mint-authority',
    payload: mintPay(9, '1000000000000000000', 'smyOwner111111111111111111111111111', {
      transferHook: 'smy-hook',
      permanentDelegate: 'smy-owner',
      feeConfig: 'smy-fee',
    }),
  }));
  push('proj-honeypot', fact(smy, {
    ...S(8, 40), kind: 'freeze-authority',
    payload: mintPay(9, '1000000000000000000', 'smyOwner111111111111111111111111111', {
      transferHook: 'smy-hook',
      permanentDelegate: 'smy-owner',
      feeConfig: 'smy-fee',
    }),
  }));
  push('proj-honeypot', fact(smy, {
    ...S(7, 41), kind: 'liquidity',
    payload: { pools: [{ dex: 'Raydium', pairAddress: 'p00lsmy1111111111111111111111111111', pair: 'SMY/SOL', tvlUsd: 120000, lpMint: 'lpsmy111111111111111111111111111', lpBurnedPct: 0, lockedUntil: null }], tvlUsdTotal: 120000, exitDepthUsd: null },
  }));
  push('proj-honeypot', fact(smy, {
    ...S(7, 42), kind: 'holder-distribution',
    payload: holdersPay('1000000000000000000', 0.85, [{ address: 'smyOwner111111111111111111111111111', amount: '700000000000000000', pctOfSupply: 0.7 }]),
  }));
  push('proj-honeypot', fact(smy, {
    ...S(6, 43), kind: 'sell-simulation',
    payload: { executable: false, method: 'fixture', inputAmount: '10000000000000000', outAmount: null, priceImpactPct: null, buy: { executable: true, outAmount: '10100000000000000', priceImpactPct: 0.009 }, detail: 'Buy route exists but no sell route for standard size — cannot exit' },
  }));
  push('proj-honeypot', fact(smy, {
    ...S(6, 45), kind: 'related-wallets',
    payload: { graphIngested: true, clusterPct: 0.7, wallets: [{ address: 'smyOwner111111111111111111111111111', label: 'owner', entity: 'SafeMoon Owner', pctOfSupply: 0.7 }], attributionConfidence: 0.85 },
  }));
  push('proj-honeypot', fact(smy, {
    ...S(6, 44), kind: 'program-verification',
    payload: { programId: smy.programId!, owner: 'BPFLoaderUpgradeab1e11111111111111111111111', upgradeAuthority: 'smyOwner111111111111111111111111111', immutable: false, verifiedBuild: null },
  }));

  return out;
}

/** Latest fact per kind for a project — the fixture provider's "current" view. */
export function currentFacts(now: Date, projectId: string): ChainFact[] {
  const timeline = fixtureTimeline(now).filter((r) => r.projectId === projectId);
  const best = new Map<string, ChainFact>();
  for (const { fact } of timeline) {
    const cur = best.get(fact.kind);
    if (!cur || fact.observedAt >= cur.observedAt) best.set(fact.kind, fact);
  }
  return [...best.values()];
}
