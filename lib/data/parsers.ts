/* eslint-disable @typescript-eslint/no-explicit-any -- untrusted external JSON is parsed defensively at this boundary */
/**
 * Pure parsers turning raw read-only API responses into contract payloads.
 * No I/O here so every branch is unit-testable; providers stay thin transports.
 */
import { b58encode } from './base58';
import type {
  HolderDistributionPayload,
  LiquidityPayload,
  MintAuthorityPayload,
  ProgramVerificationPayload,
  SellSimulationPayload,
} from './contract';

function tokenControls(info: any): Pick<
  MintAuthorityPayload,
  'transferHook' | 'permanentDelegate' | 'feeConfig' | 'token2022Extensions'
> {
  const raw = Array.isArray(info.extensions) ? info.extensions : [];
  const names = raw.map((e: any) => String(e?.extension ?? e)).filter(Boolean);
  let transferHook = info.transferHook ? String(info.transferHook) : null;
  let permanentDelegate = info.permanentDelegate ? String(info.permanentDelegate) : null;
  let feeConfig = info.feeConfig ? String(info.feeConfig) : null;
  for (const e of raw) {
    const name = String(e?.extension ?? '');
    if (name === 'transferHook') transferHook = String(e.state?.programId ?? transferHook ?? 'present');
    if (name === 'permanentDelegate') permanentDelegate = String(e.state?.delegate ?? permanentDelegate ?? 'present');
    if (name === 'transferFeeConfig' || name === 'transferFeeAmount') feeConfig = feeConfig ?? 'present';
  }
  return { transferHook, permanentDelegate, feeConfig, token2022Extensions: names };
}

/** SPL Token program "spl-token" jsonParsed `info` object from getAccountInfo. */
export function parseMintAccount(info: any): MintAuthorityPayload | null {
  if (!info || typeof info !== 'object') return null;
  return {
    decimals: Number(info.decimals ?? 0),
    supply: String(info.supply ?? '0'),
    mintAuthority: info.mintAuthority ? String(info.mintAuthority) : null,
    freezeAuthority: info.freezeAuthority ? String(info.freezeAuthority) : null,
    ...tokenControls(info),
  };
}

/** getTokenLargestAccounts value[] + getTokenSupply parsed info. */
export function parseHolderAccounts(
  largest: any[] | null,
  supplyInfo: any,
): HolderDistributionPayload | null {
  const supply = String(supplyInfo?.supply ?? '0');
  const supplyNum = Number(supply);
  if (!Array.isArray(largest) || supplyNum <= 0) return null;
  const topAccounts = largest.slice(0, 10).map((a: any) => {
    const amount = String(a.amount ?? '0');
    return {
      address: String(a.address),
      amount,
      pctOfSupply: Number(amount) / supplyNum,
    };
  });
  return {
    supply,
    topAccounts,
    top10Pct: topAccounts.reduce((acc, a) => acc + a.pctOfSupply, 0),
    top10PctEntityAdjusted: null,
  };
}

const BPF_UPGRADEABLE_LOADER = 'BPFLoaderUpgradeab1e11111111111111111111111';
export const UPGRADEABLE_LOADER_ID = BPF_UPGRADEABLE_LOADER;

/**
 * BPFUpgradeableProgram layout:
 *   program account data = [u32 len][programdata pubkey (32)]
 *   programdata account  = [u32 enum][u64 slot][Option<Pubkey> authority]
 * `immutable` means the upgrade authority option is empty (authority revoked).
 */
export function parseProgramAccounts(
  programId: string,
  programAcct: { data: [string, string] } | null,
  programDataAcct: { data: [string, string] } | null,
): ProgramVerificationPayload {
  const base: ProgramVerificationPayload = {
    programId,
    owner: null,
    upgradeAuthority: null,
    immutable: false,
    verifiedBuild: null,
  };
  if (!programAcct) return base;
  const progBytes = Buffer.from(programAcct.data[0], 'base64');
  if (progBytes.length < 36) return { ...base, immutable: true };
  let authority: string | null = null;
  let immutable = false;
  if (programDataAcct) {
    const pd = Buffer.from(programDataAcct.data[0], 'base64');
    if (pd.length >= 16) {
      const optionLen = pd.readUInt32LE(12);
      if (optionLen === 0) immutable = true;
      else if (pd.length >= 48) authority = b58encode(pd.subarray(16, 48));
    }
  }
  return { ...base, upgradeAuthority: authority, immutable };
}

/** DexScreener /latest/dex/tokens/{mint} response. LP burn is not provable from this source → null. */
export function parseDexScreener(json: any, mint: string): LiquidityPayload {
  const pairs = Array.isArray(json?.pairs) ? json.pairs : [];
  const relevant = pairs
    .filter((p: any) => p?.baseToken?.address === mint || p?.quoteToken?.address === mint)
    .map((p: any) => ({
      dex: String(p.dexId ?? 'unknown'),
      pairAddress: String(p.pairAddress ?? ''),
      pair: `${p.baseToken?.symbol ?? '?'}/${p.quoteToken?.symbol ?? '?'}`,
      tvlUsd: typeof p.liquidity?.usd === 'number' ? p.liquidity.usd : null,
      lpMint: null as string | null,
      lpBurnedPct: null as number | null,
      lockedUntil: null as string | null,
    }));
  const tvls = relevant.map((p: any) => p.tvlUsd ?? 0);
  return {
    pools: relevant.slice(0, 5),
    tvlUsdTotal: relevant.length ? tvls.reduce((a: number, b: number) => a + b, 0) : null,
    exitDepthUsd: null,
  };
}

export const SELL_MAX_PRICE_IMPACT_PCT = 0.05;

/** Jupiter lite-api /swap/v1/quote response (or null when no route). */
export function parseJupiterQuote(
  quote: any,
  inputAmount: string,
): SellSimulationPayload {
  if (!quote || !quote.outAmount) {
    return {
      executable: false,
      method: 'jupiter-quote',
      inputAmount,
      outAmount: null,
      priceImpactPct: null,
      buy: null,
      detail: 'No route returned for standard sell size',
    };
  }
  const impact = quote.priceImpactPct != null ? Number(quote.priceImpactPct) : null;
  const executable = impact == null || impact <= SELL_MAX_PRICE_IMPACT_PCT;
  return {
    executable,
    method: 'jupiter-quote',
    inputAmount,
    outAmount: String(quote.outAmount),
    priceImpactPct: impact,
    buy: null,
    detail: executable
      ? `Route exists, out ${quote.outAmount}, impact ${impact ?? 'n/a'}`
      : `Route exists but price impact ${(impact! * 100).toFixed(2)}% exceeds ${(SELL_MAX_PRICE_IMPACT_PCT * 100).toFixed(0)}%`,
  };
}

/** Buy leg from the reverse (WSOL → token) quote; null when no route. */
export function parseBuyQuote(quote: any): { executable: boolean; outAmount: string | null; priceImpactPct: number | null } | null {
  if (!quote || !quote.outAmount) return null;
  const impact = quote.priceImpactPct != null ? Number(quote.priceImpactPct) : null;
  return {
    executable: impact == null || impact <= SELL_MAX_PRICE_IMPACT_PCT,
    outAmount: String(quote.outAmount),
    priceImpactPct: impact,
  };
}

/**
 * Standard sell-simulation size: 0.01% of supply in raw units. A fixed
 * percentage (like 1%) produces absurd notional sizes on huge-supply mints
 * (BONK ≈ $60M) that no route absorbs; 0.01% lands near a realistic trade
 * (~$1k on BONK) while still probing real depth.
 */
export function standardSellSize(supply: string): string {
  const n = Number(supply);
  if (!Number.isFinite(n) || n <= 0) return '0';
  return String(Math.floor(n / 10_000));
}
