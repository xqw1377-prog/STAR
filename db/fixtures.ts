import { InferInsertModel } from 'drizzle-orm';
import * as s from './schema';

/**
 * Synthetic Solana history. The evidence stream is time-layered (see
 * lib/data/star-fixture.ts) so Replay Lab can slide an asOf cutoff and watch
 * gates flip. ingestedAt = observedAt + 1h keeps the temporal invariant
 * (a fact can be observed before it is ingested, never the reverse).
 * Every fixture project is labeled SYNTHETIC (SAFE-004).
 */
import { fixtureTimeline } from '@/lib/data/star-fixture';

const now = new Date('2026-09-02T00:00:00Z');
const dayAgo = (n: number) => new Date(now.getTime() - n * 86400000);

/** FNV-1a — deterministic, browser-safe (no node:crypto in the idb seed path). */
function stableHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const CONCLUSIONS: Record<string, (p: any) => string> = {
  'mint-authority': (p) => (p.mintAuthority ? `Mint authority live: ${p.mintAuthority}` : 'Mint authority revoked'),
  'freeze-authority': (p) => (p.freezeAuthority ? `Freeze authority live: ${p.freezeAuthority}` : 'Freeze authority revoked'),
  'holder-distribution': (p) =>
    p.top10PctEntityAdjusted == null
      ? 'Entity-adjusted concentration missing'
      : `Entity-adjusted top-10 hold ${(p.top10PctEntityAdjusted * 100).toFixed(0)}% of supply`,
  liquidity: (p) =>
    `TVL $${p.tvlUsdTotal != null ? Math.round(p.tvlUsdTotal).toLocaleString('en-US') : '—'}${p.exitDepthUsd != null ? `; exit depth $${Math.round(p.exitDepthUsd).toLocaleString('en-US')}` : '; exit depth unobserved'}`,
  'sell-simulation': (p) => (p.executable && p.buy?.executable !== false
    ? `Buy+sell executable: ${p.detail}`
    : `Tradability broken: ${p.detail}`),
  'related-wallets': (p) => `Related cluster holds ${(p.clusterPct * 100).toFixed(0)}% (${p.wallets.length} labeled wallets)`,
  'program-verification': (p) => (p.verifiedBuild ? 'Verified build' : p.upgradeAuthority ? `Upgrade authority: ${p.upgradeAuthority}` : 'Program state unproven'),
};

const MINT_TO_PROJECT: Record<string, string> = {
  'nswarm11111111111111111111111111': 'proj-neural',
  'llml2222222222222222222222222222': 'proj-llm-lab',
  'rckt3333333333333333333333333333': 'proj-rocket',
  'smy44444444444444444444444444444': 'proj-honeypot',
};

export const evidence: InferInsertModel<typeof s.evidence>[] = fixtureTimeline(now).map(({ fact }) => ({
  projectId: MINT_TO_PROJECT[fact.mint],
  type: fact.kind,
  observedAt: new Date(fact.observedAt),
  effectiveAt: new Date(fact.observedAt),
  ingestedAt: new Date(new Date(fact.observedAt).getTime() + 3600000),
  source: fact.source,
  sourceUrl: fact.sourceUrl ?? '',
  hash: stableHash(`${fact.kind}|${fact.observedAt}|${JSON.stringify(fact.payload)}`),
  payload: fact.payload as any,
  conclusion: (CONCLUSIONS[fact.kind] ?? (() => ''))(fact.payload),
  conflictWith: null,
}));

export const chains: InferInsertModel<typeof s.chains>[] = [
  { id: 'solana', name: 'Solana' },
];

export const narratives: InferInsertModel<typeof s.narratives>[] = [
  {
    id: 'ai-agent',
    name: 'AI Agent on Solana',
    stage: 'VERIFIED',
    novelty: 0.85,
    velocity: 0.72,
    breadth: 0.68,
    onChainConfirm: 0.77,
    survival: 0.80,
    discoveredAt: dayAgo(21),
    updatedAt: dayAgo(1),
    aliases: ['AI x Solana', 'Autonomous Agent'],
  },
  {
    id: 'meme-2',
    name: 'Solana Meme Wave 2',
    stage: 'IGNITION',
    novelty: 0.55,
    velocity: 0.88,
    breadth: 0.45,
    onChainConfirm: 0.62,
    survival: 0.30,
    discoveredAt: dayAgo(12),
    updatedAt: dayAgo(2),
    aliases: ['Meme 2.0'],
  },
];

export const projects: InferInsertModel<typeof s.projects>[] = [
  {
    id: 'proj-neural',
    name: 'Neural Swarm',
    symbol: 'NSWARM',
    chainId: 'solana',
    narrativeId: 'ai-agent',
    tokenMint: 'nswarm11111111111111111111111111',
    programId: 'ProgNs...1111',
    website: 'https://neural-swarm.dev',
    github: 'https://github.com/neural-swarm',
    twitter: 'https://x.com/neural_swarm',
    lifecycle: 'VERIFIED',
    decisionReadiness: 0,
    discoveredAt: dayAgo(18),
  },
  {
    id: 'proj-llm-lab',
    name: 'LLM Lab',
    symbol: 'LLML',
    chainId: 'solana',
    narrativeId: 'ai-agent',
    tokenMint: 'llml2222222222222222222222222222',
    programId: 'ProgLL...2222',
    website: 'https://llm-lab.ai',
    github: 'https://github.com/llm-lab',
    twitter: 'https://x.com/llm_lab',
    lifecycle: 'IGNITION',
    decisionReadiness: 0,
    discoveredAt: dayAgo(14),
  },
  {
    id: 'proj-rocket',
    name: 'Rocket Moon',
    symbol: 'RCKT',
    chainId: 'solana',
    narrativeId: 'meme-2',
    tokenMint: 'rckt3333333333333333333333333333',
    programId: 'ProgRc...3333',
    website: 'https://rocket-moon.meme',
    twitter: 'https://x.com/rocket_moon',
    lifecycle: 'CROWDING',
    decisionReadiness: 0,
    discoveredAt: dayAgo(10),
  },
  {
    id: 'proj-honeypot',
    name: 'SafeMoon Yield',
    symbol: 'SMY',
    chainId: 'solana',
    narrativeId: 'meme-2',
    tokenMint: 'smy44444444444444444444444444444',
    programId: 'ProgSM...4444',
    website: 'https://safemoon-yield.io',
    lifecycle: 'IGNITION',
    decisionReadiness: 0,
    discoveredAt: dayAgo(8),
  },
];

export const tokens: InferInsertModel<typeof s.tokens>[] = [
  { id: 'tok-nswarm', projectId: 'proj-neural', mintAuthority: null, freezeAuthority: null, transferHook: null, permanentDelegate: null, feeConfig: null, verifiedBuild: 'verified', upgradeAuthority: 'team-multisig-1' },
  { id: 'tok-llml', projectId: 'proj-llm-lab', mintAuthority: null, freezeAuthority: null, transferHook: null, permanentDelegate: null, feeConfig: null, verifiedBuild: 'verified', upgradeAuthority: 'team-multisig-1' },
  { id: 'tok-rckt', projectId: 'proj-rocket', mintAuthority: 'rckt-owner', freezeAuthority: 'rckt-owner', transferHook: 'rckt-hook', permanentDelegate: null, feeConfig: null, verifiedBuild: null, upgradeAuthority: 'rckt-owner' },
  { id: 'tok-smy', projectId: 'proj-honeypot', mintAuthority: 'smy-owner', freezeAuthority: 'smy-owner', transferHook: 'smy-hook', permanentDelegate: 'smy-owner', feeConfig: 'smy-fee', verifiedBuild: null, upgradeAuthority: 'smy-owner' },
];

export const pools: InferInsertModel<typeof s.pools>[] = [
  { id: 'pool-nswarm', projectId: 'proj-neural', dex: 'Raydium', pair: 'NSWARM/SOL', tvlUsd: 850000, lockInfo: { lpBurned: true, amount: 0.85 } },
  { id: 'pool-llml', projectId: 'proj-llm-lab', dex: 'Orca', pair: 'LLML/SOL', tvlUsd: 320000, lockInfo: { locked: true, until: '2027-03-01' } },
  { id: 'pool-rckt', projectId: 'proj-rocket', dex: 'Raydium', pair: 'RCKT/SOL', tvlUsd: 2100000, lockInfo: { lpBurned: false } },
  { id: 'pool-smy', projectId: 'proj-honeypot', dex: 'Raydium', pair: 'SMY/SOL', tvlUsd: 120000, lockInfo: { lpBurned: false } },
];

export const wallets: InferInsertModel<typeof s.wallets>[] = [
  { id: 'w1', projectId: 'proj-neural', address: 'nswarmTeamVest11111111111111111111', entityId: 'e-team', label: 'team vesting', firstIn: dayAgo(18), balanceUsd: 120000 },
  { id: 'w2', projectId: 'proj-neural', address: 'nswarmMm111111111111111111111111111', entityId: 'e-mm', label: 'market maker', firstIn: dayAgo(17), balanceUsd: 40000 },
  { id: 'w3', projectId: 'proj-rocket', address: 'rcktOwner11111111111111111111111111', entityId: 'e-owner', label: 'owner', firstIn: dayAgo(10), balanceUsd: 950000 },
  { id: 'w4', projectId: 'proj-honeypot', address: 'smyOwner111111111111111111111111111', entityId: 'e-smy', label: 'owner', firstIn: dayAgo(8), balanceUsd: 80000 },
];

export const entities: InferInsertModel<typeof s.entities>[] = [
  { id: 'e-team', projectId: 'proj-neural', name: 'Neural Swarm Team', type: 'team', confidence: 0.92, evidenceSummary: 'Linked to deployer, GitHub, Twitter' },
  { id: 'e-mm', projectId: 'proj-neural', name: 'MM A', type: 'market_maker', confidence: 0.70, evidenceSummary: 'Early pool seeding' },
  { id: 'e-owner', projectId: 'proj-rocket', name: 'Rocket Owner', type: 'owner', confidence: 0.88, evidenceSummary: 'Holds mint authority and 45% supply' },
  { id: 'e-smy', projectId: 'proj-honeypot', name: 'SafeMoon Owner', type: 'owner', confidence: 0.85, evidenceSummary: 'Holds all privileged authorities' },
];

export const graphEdges: InferInsertModel<typeof s.graphEdges>[] = [
  { source: 'w1', target: 'w2', projectId: 'proj-neural', type: 'co-funding', evidence: 'Shared DEX router seed', confidence: 0.65 },
  { source: 'w3', target: 'e-owner', projectId: 'proj-rocket', type: 'control', evidence: 'Mint authority', confidence: 0.90 },
  { source: 'w4', target: 'e-smy', projectId: 'proj-honeypot', type: 'control', evidence: 'Privileged authorities', confidence: 0.95 },
];
