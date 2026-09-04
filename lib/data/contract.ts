/**
 * STAR P0-DATA — Frozen read-only Solana data contract.
 *
 * Everything the STAR engine knows about a chain arrives as a ChainFact
 * produced by a ReadonlyChainProvider. A fact is an *observation*: it states
 * what was true at `observedAt`, backed by `slot` (chain state) or an
 * off-chain source that must be named. Facts are immutable once recorded;
 * re-observation produces a new fact.
 *
 * This contract is frozen for the P0-DATA phase. Additive changes require a
 * new contractVersion; breaking changes are forbidden until P1.
 */

/** Unique observation contract (D2). Gate interpretation is `star-web/lib/domain`. */
export const CONTRACT_VERSION = 'solana-readonly@3' as const;

export const FACT_KINDS = [
  'mint-authority',
  'freeze-authority',
  'holder-distribution',
  'liquidity',
  'sell-simulation',
  'related-wallets',
  'program-verification',
] as const;

export type FactKind = (typeof FACT_KINDS)[number];

/** SPL Mint account authorities and supply, decoded from the mint account. */
export interface MintAuthorityPayload {
  decimals: number;
  supply: string;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  transferHook: string | null;
  permanentDelegate: string | null;
  feeConfig: string | null;
  /** Empty array = resolved none; null/omitted = not decoded → UNKNOWN */
  token2022Extensions: string[] | null;
}

/** Top token accounts vs total supply. */
export interface HolderDistributionPayload {
  supply: string;
  topAccounts: { address: string; amount: string; pctOfSupply: number }[];
  top10Pct: number;
  /** Required for PASS. Address-level top10Pct alone is UNKNOWN. */
  top10PctEntityAdjusted: number | null;
}

/**
 * Liquidity facts. `pools` is what public read-only sources can prove:
 * pool identity plus TVL. `lpBurnedPct` requires an LP-mint decode and may
 * be null when the pool layout is not decodable — the liquidity gate then
 * stays UNKNOWN rather than guessing.
 */
export interface LiquidityPayload {
  pools: {
    dex: string;
    pairAddress: string;
    pair: string;
    tvlUsd: number | null;
    lpMint: string | null;
    lpBurnedPct: number | null;
    lockedUntil: string | null;
  }[];
  tvlUsdTotal: number | null;
  /** Required for PASS together with TVL and LP lock/burn. */
  exitDepthUsd: number | null;
}

/**
 * Buy/sell simulation (可买可卖). Executable means: a read-only route quote
 * for trading a standard size existed at observedAt with price impact under
 * threshold. Both legs are required by GATE-002; a missing leg is UNKNOWN,
 * never assumed. No wallet, no signature, no state change.
 */
export interface SellSimulationPayload {
  executable: boolean;
  method: 'jupiter-quote' | 'fixture';
  inputAmount: string;
  outAmount: string | null;
  priceImpactPct: number | null;
  /** Buy leg (quote WSOL → token). Absent on @1 evidence → check UNKNOWN. */
  buy?: {
    executable: boolean;
    outAmount: string | null;
    priceImpactPct: number | null;
  } | null;
  detail: string;
}

/**
 * Related-wallet cluster observation (关联钱包): labeled wallets attributed
 * to deployer/team/MM entities and their clustered share of supply. An
 * independent gate — a holder-concentration PASS cannot substitute it.
 */
export interface RelatedWalletsPayload {
  clusterPct: number;
  wallets: { address: string; label: string; entity: string; pctOfSupply: number }[];
  attributionConfidence: number;
  /** False/absent = WALLET_GRAPH_MISSING. Fixture graphs set true. */
  graphIngested: boolean;
}

/** Program upgrade authority state and (optionally) verified-build status. */
export interface ProgramVerificationPayload {
  programId: string;
  owner: string | null;
  upgradeAuthority: string | null;
  immutable: boolean;
  verifiedBuild: boolean | null;
  /** False when the account bytes are too short or unreadable. */
  accountParsed?: boolean;
}

export type FactPayload = {
  'mint-authority': MintAuthorityPayload;
  'freeze-authority': MintAuthorityPayload;
  'holder-distribution': HolderDistributionPayload;
  liquidity: LiquidityPayload;
  'sell-simulation': SellSimulationPayload;
  'related-wallets': RelatedWalletsPayload;
  'program-verification': ProgramVerificationPayload;
};

export interface ChainFact<K extends FactKind = FactKind> {
  kind: K;
  contractVersion: string;
  /** When the observation was made (wall clock, ISO 8601 UTC). */
  observedAt: string;
  /** Chain slot the observation is anchored to, when on-chain. */
  slot: number | null;
  /** Who observed it, e.g. 'solana-rpc:api.mainnet-beta' or 'fixture'. */
  source: string;
  sourceUrl: string | null;
  chainId: string;
  mint: string;
  payload: FactPayload[K];
}

export class ContractViolation extends Error {}

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const PUBKEY_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function assertFact<K extends FactKind>(fact: ChainFact<K>): ChainFact<K> {
  const fail = (why: string) => {
    throw new ContractViolation(`fact ${fact?.kind ?? '?'} rejected: ${why}`);
  };
  if (!fact || typeof fact !== 'object') fail('not an object');
  if (!FACT_KINDS.includes(fact.kind)) fail(`unknown kind ${fact.kind}`);
  if (fact.contractVersion !== CONTRACT_VERSION) {
    fail(`contractVersion ${fact.contractVersion} != ${CONTRACT_VERSION}`);
  }
  if (!ISO_RE.test(fact.observedAt)) fail(`observedAt not ISO-UTC: ${fact.observedAt}`);
  if (!Number.isInteger(fact.slot) && fact.slot !== null) fail('slot must be integer or null');
  if (!fact.source) fail('source missing');
  if (fact.chainId !== 'solana') fail(`chainId must be 'solana', got ${fact.chainId}`);
  if (!PUBKEY_RE.test(fact.mint)) fail(`mint not a pubkey: ${fact.mint}`);
  if (!fact.payload || typeof fact.payload !== 'object') fail('payload missing');
  assertPayload(fact.kind, fact.payload as unknown as Record<string, unknown>, fail);
  return fact;
}

function assertPayload(kind: FactKind, payload: Record<string, unknown>, fail: (why: string) => never): void {
  if (kind === 'sell-simulation') {
    if (typeof payload.executable !== 'boolean') fail('sell.executable required');
  }
  if (kind === 'related-wallets') {
    if (typeof payload.graphIngested !== 'boolean') fail('related-wallets.graphIngested required');
    if (typeof payload.clusterPct !== 'number') fail('related-wallets.clusterPct required');
  }
  if (kind === 'program-verification') {
    if (typeof payload.programId !== 'string') fail('programId required');
  }
  if (kind === 'holder-distribution') {
    if (typeof payload.top10Pct !== 'number') fail('top10Pct required');
  }
}

/**
 * A read-only chain data source. Implementations MUST NOT sign, send, or
 * mutate anything: no keypairs, no sendTransaction, no write calls. Transport
 * failures throw; absence of a provable fact yields a payload with nulls
 * (the collector then records no evidence and the gate stays UNKNOWN).
 */
export interface ReadonlyChainProvider {
  readonly id: string;
  readonly contractVersion: string;
  mintAuthorities(mint: string): Promise<ChainFact<'mint-authority'>>;
  holderDistribution(mint: string): Promise<ChainFact<'holder-distribution'>>;
  liquidity(mint: string): Promise<ChainFact<'liquidity'>>;
  sellSimulation(mint: string): Promise<ChainFact<'sell-simulation'>>;
  relatedWallets(mint: string): Promise<ChainFact<'related-wallets'>>;
  programVerification(mint: string, programId: string | null): Promise<ChainFact<'program-verification'>>;
}
