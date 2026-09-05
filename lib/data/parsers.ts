/* eslint-disable @typescript-eslint/no-explicit-any -- untrusted external JSON is parsed defensively at this boundary */
/**
 * Pure parsers turning raw read-only API responses into contract payloads.
 * No I/O here so every branch is unit-testable; providers stay thin transports.
 *
 * G1-B AUDIT SCOPE (2026-09-05, Gate #1 remediation F1/F3/F5/F6):
 *   IN SCOPE  — Helius JSON-RPC five methods (getAccountInfo /
 *               getMultipleAccounts / getTokenSupply / getTokenLargestAccounts /
 *               getSlot): raw values pass through, missing stays missing,
 *               undecodable accounts are rejected (fact = null → UNKNOWN).
 *   OUT OF SCOPE — DexScreener + Jupiter parsers below remain under
 *               LEGAL_REVIEW in the source registry; they are NOT covered by
 *               this remediation batch and must not be "fixed" alongside it.
 *
 * Governance rules enforced here (FROZEN-rev1 / Gate #1 anti-patterns):
 *   no business verdicts, no default fills, no private translation tables.
 */
import { b58encode } from './base58';
import type {
  HolderDistributionPayload,
  LiquidityPayload,
  MintAuthorityPayload,
  ProgramVerificationPayload,
  SellSimulationPayload,
} from './contract';

/** Protocol layout facts (not business judgments): SPL program ids. */
const SPL_TOKEN_V1_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPBXCWu2f9kRxMmNei2';

function tokenControls(info: any, owner: string | null): Pick<
  MintAuthorityPayload,
  'transferHook' | 'permanentDelegate' | 'feeConfig' | 'token2022Extensions'
> {
  // F1: a missing extensions field stays missing. Only a POSITIVE report
  // (array present) resolves to names, and only the protocol fact
  // "owner == SPL Token v1" (v1 has no extension mechanism) can prove an
  // empty set. Token-2022 with the field absent → null → gate UNKNOWN.
  const reported = Array.isArray(info.extensions) ? info.extensions : null;
  const names = reported ? reported.map((e: any) => String(e?.extension ?? e)).filter(Boolean) : null;
  let token2022Extensions: string[] | null = null;
  if (names) token2022Extensions = names;
  else if (owner === SPL_TOKEN_V1_PROGRAM) token2022Extensions = [];

  let transferHook = info.transferHook ? String(info.transferHook) : null;
  let permanentDelegate = info.permanentDelegate ? String(info.permanentDelegate) : null;
  let feeConfig = info.feeConfig ? String(info.feeConfig) : null;
  for (const e of reported ?? []) {
    const name = String(e?.extension ?? '');
    if (name === 'transferHook') transferHook = String(e.state?.programId ?? transferHook ?? 'present');
    if (name === 'permanentDelegate') permanentDelegate = String(e.state?.delegate ?? permanentDelegate ?? 'present');
    if (name === 'transferFeeConfig' || name === 'transferFeeAmount') feeConfig = feeConfig ?? 'present';
  }
  return { transferHook, permanentDelegate, feeConfig, token2022Extensions };
}

/** SPL Token program "spl-token" jsonParsed `info` object from getAccountInfo. */
export function parseMintAccount(info: any, owner: string | null = null): MintAuthorityPayload | null {
  if (!info || typeof info !== 'object') return null;
  // F5: structurally required mint fields are either present or the account
  // is undecodable — the whole fact is rejected (never defaulted to 0/'0').
  // Provider gave 0 → recorded 0; provider gave nothing → no fact → UNKNOWN.
  if (typeof info.decimals !== 'number') return null;
  if (typeof info.supply !== 'string' && typeof info.supply !== 'number') return null;
  return {
    decimals: Number(info.decimals),
    supply: String(info.supply),
    mintAuthority: info.mintAuthority ? String(info.mintAuthority) : null,
    freezeAuthority: info.freezeAuthority ? String(info.freezeAuthority) : null,
    ...tokenControls(info, owner),
  };
}

/** F3: the fact slot is the Provider's own context.slot for THIS data — a
 * separately fetched clock slot must never masquerade as data freshness. */
export function holderFactSlot(largestRes: any, supplyRes: any): number | null {
  return largestRes?.context?.slot ?? supplyRes?.context?.slot ?? null;
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
  if (!programAcct) return { ...base, accountParsed: false };
  const progBytes = Buffer.from(programAcct.data[0], 'base64');
  if (progBytes.length < 36) return { ...base, accountParsed: false, immutable: false };
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
  return { ...base, upgradeAuthority: authority, immutable, accountParsed: true };
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

/**
 * Jupiter lite-api /swap/v1/quote response (or null when no route).
 *
 * F2-A (2026-09-05): adapters produce RAW OBSERVATIONS only. The 5%
 * `executable` verdict is deleted — it had no governance standing (D1: E-01
 * ≥80% + ≤15% is the sole source of truth, interpreted in the governed
 * layer under F2-B). priceImpactPct passes through untouched.
 */
export function parseJupiterQuote(
  quote: any,
  inputAmount: string,
): SellSimulationPayload {
  if (!quote || !quote.outAmount) {
    return {
      method: 'jupiter-quote',
      inputAmount,
      outAmount: null,
      priceImpactPct: null,
      buy: null,
      detail: 'No route returned for standard sell size',
    };
  }
  const impact = quote.priceImpactPct != null ? Number(quote.priceImpactPct) : null;
  return {
    method: 'jupiter-quote',
    inputAmount,
    outAmount: String(quote.outAmount),
    priceImpactPct: impact == null || Number.isNaN(impact) ? null : impact,
    buy: null,
    detail: impact == null || Number.isNaN(impact)
      ? 'Route exists but priceImpactPct not reported (raw fact; interpretation deferred)'
      : `Route exists, out ${quote.outAmount}, impact ${impact}`,
  };
}

/** Buy leg from the reverse (WSOL → token) quote; null when no route. */
export function parseBuyQuote(quote: any): { outAmount: string | null; priceImpactPct: number | null } | null {
  if (!quote || !quote.outAmount) return null;
  const impact = quote.priceImpactPct != null ? Number(quote.priceImpactPct) : null;
  return {
    outAmount: String(quote.outAmount),
    priceImpactPct: impact == null || Number.isNaN(impact) ? null : impact,
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
