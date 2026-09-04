import { THRESHOLDS } from './thresholds';
import type { GateStatus } from './types';

export interface InterpretResult {
  status: GateStatus;
  claim: string;
}

export interface InterpretContext {
  asOf?: Date;
}

function asRecord(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
}

function privilegedToken(p: Record<string, unknown>): string[] {
  const found: string[] = [];
  if (p.mintAuthority) found.push(`mint:${p.mintAuthority}`);
  if (p.freezeAuthority) found.push(`freeze:${p.freezeAuthority}`);
  if (p.transferHook) found.push(`transfer-hook:${p.transferHook}`);
  if (p.permanentDelegate) found.push(`permanent-delegate:${p.permanentDelegate}`);
  if (p.feeConfig) found.push(`fee:${p.feeConfig}`);
  if (Array.isArray(p.token2022Extensions) && p.token2022Extensions.length) {
    found.push(`token-2022:${p.token2022Extensions.join(',')}`);
  }
  return found;
}

function interpretToken(p: Record<string, unknown>, focus: 'mint' | 'freeze'): InterpretResult {
  const found = privilegedToken(p);
  if (found.length) return { status: 'FAIL', claim: `Privileged controls present: ${found.join(', ')}` };
  if (p.token2022Extensions == null) {
    return { status: 'UNKNOWN', claim: 'Token-2022 extensions not resolved' };
  }
  return {
    status: 'PASS',
    claim: focus === 'mint' ? 'Mint and Token-2022 controls resolved, none privileged' : 'Freeze authority resolved and empty',
  };
}

function impactMissing(impact: unknown): boolean {
  return impact == null || (typeof impact === 'number' && Number.isNaN(impact));
}

function interpretSell(p: Record<string, unknown>): InterpretResult {
  if (p.executable === false) return { status: 'FAIL', claim: String(p.detail ?? 'Sell path not executable') };
  if (impactMissing(p.priceImpactPct)) {
    return { status: 'UNKNOWN', claim: 'Sell priceImpactPct not observed' };
  }
  const buy = p.buy as { executable?: boolean; priceImpactPct?: number | null } | null | undefined;
  if (!buy) return { status: 'UNKNOWN', claim: 'Buy path unproven' };
  if (impactMissing(buy.priceImpactPct)) return { status: 'UNKNOWN', claim: 'Buy priceImpactPct not observed' };
  if (buy.executable === false) return { status: 'FAIL', claim: 'Buy path not executable' };
  return { status: 'PASS', claim: 'Buy and sell paths executable with observed impact' };
}

function lockStillActive(pool: Record<string, unknown>, asOf: Date): boolean {
  const burned = typeof pool.lpBurnedPct === 'number' && pool.lpBurnedPct >= THRESHOLDS.LP_BURN_MIN_PCT;
  if (burned) return true;
  if (typeof pool.lockedUntil !== 'string' || !pool.lockedUntil) return false;
  const until = Date.parse(pool.lockedUntil);
  if (!Number.isFinite(until)) return false;
  return until > asOf.getTime();
}

function interpretLiquidity(p: Record<string, unknown>, asOf: Date): InterpretResult {
  const tvl = typeof p.tvlUsdTotal === 'number' ? p.tvlUsdTotal : null;
  if (tvl == null) return { status: 'UNKNOWN', claim: 'TVL not observed' };
  if (tvl < THRESHOLDS.LIQUIDITY_MIN_TVL_USD) return { status: 'FAIL', claim: `TVL too low: $${tvl}` };
  const pools = Array.isArray(p.pools) ? (p.pools as Record<string, unknown>[]) : [];
  if (!pools.length) return { status: 'UNKNOWN', claim: `TVL $${tvl}; no pool attribution` };

  let lockedTvl = 0;
  let sawLockAttempt = false;
  for (const pool of pools) {
    const poolTvl = typeof pool.tvlUsd === 'number'
      ? pool.tvlUsd
      : pools.length === 1
        ? tvl
        : 0;
    const locked = lockStillActive(pool, asOf);
    if (typeof pool.lockedUntil === 'string' || typeof pool.lpBurnedPct === 'number') sawLockAttempt = true;
    if (locked) lockedTvl += poolTvl;
  }
  if (lockedTvl < THRESHOLDS.LIQUIDITY_MIN_TVL_USD) {
    if (!sawLockAttempt || lockedTvl === 0) {
      return { status: 'UNKNOWN', claim: `TVL $${tvl}; LP lock/burn not proven on qualifying pools` };
    }
    return { status: 'FAIL', claim: `Locked/burned TVL $${lockedTvl} cannot endorse aggregate TVL $${tvl}` };
  }
  const depth = typeof p.exitDepthUsd === 'number' ? p.exitDepthUsd : null;
  if (depth == null) return { status: 'UNKNOWN', claim: 'Exit depth not observed' };
  if (depth < THRESHOLDS.EXIT_DEPTH_MIN_USD) {
    return { status: 'FAIL', claim: `Exit depth $${depth} below research size $${THRESHOLDS.EXIT_DEPTH_MIN_USD}` };
  }
  return { status: 'PASS', claim: `Qualified locked TVL $${lockedTvl}; exit depth $${depth}` };
}

function interpretHolders(p: Record<string, unknown>): InterpretResult {
  const adjusted = typeof p.top10PctEntityAdjusted === 'number' ? p.top10PctEntityAdjusted : null;
  if (adjusted == null) {
    return { status: 'UNKNOWN', claim: 'Entity-adjusted concentration missing; address-level top10 cannot PASS' };
  }
  if (adjusted > THRESHOLDS.HOLDER_ENTITY_TOP10_MAX) {
    return { status: 'FAIL', claim: `Entity-adjusted top10 ${(adjusted * 100).toFixed(0)}% exceeds ${THRESHOLDS.HOLDER_ENTITY_TOP10_MAX * 100}%` };
  }
  return { status: 'PASS', claim: `Entity-adjusted top10 ${(adjusted * 100).toFixed(0)}% within threshold` };
}

function interpretRelated(p: Record<string, unknown>): InterpretResult {
  if (p.graphIngested !== true) {
    return { status: 'UNKNOWN', claim: 'WALLET_GRAPH_MISSING: clusterPct without ingested graph cannot PASS' };
  }
  if (typeof p.clusterPct !== 'number') return { status: 'UNKNOWN', claim: 'Related-wallet cluster not observed' };
  if (p.clusterPct > THRESHOLDS.RELATED_CLUSTER_MAX_PCT) {
    return { status: 'FAIL', claim: `Related cluster ${(p.clusterPct * 100).toFixed(0)}% exceeds ${THRESHOLDS.RELATED_CLUSTER_MAX_PCT * 100}%` };
  }
  return { status: 'PASS', claim: `Related cluster ${(p.clusterPct * 100).toFixed(0)}% within threshold; graph ingested` };
}

function interpretProgram(p: Record<string, unknown>): InterpretResult {
  if (p.accountParsed === false) {
    return { status: 'UNKNOWN', claim: 'Program account malformed or too short to parse' };
  }
  if (p.verifiedBuild === true && p.owner) {
    return { status: 'PASS', claim: 'Verified build with proven owner' };
  }
  if (p.immutable === true && p.verifiedBuild !== true) {
    return { status: 'UNKNOWN', claim: 'Immutable flag without verified build/owner proof cannot PASS' };
  }
  if (p.upgradeAuthority) return { status: 'FAIL', claim: `Upgradeable without verified build: ${p.upgradeAuthority}` };
  return { status: 'UNKNOWN', claim: 'Program state not provable' };
}

/** Canonical payload → gate status. UI must not reimplement these rules. */
export function interpretCheck(kind: string, payload: unknown, ctx: InterpretContext = {}): InterpretResult {
  const p = asRecord(payload);
  const asOf = ctx.asOf ?? new Date();
  switch (kind) {
    case 'mint-authority':
    case 'token-authority':
      return interpretToken(p, 'mint');
    case 'freeze-authority':
      return interpretToken(p, 'freeze');
    case 'sell-simulation':
      return interpretSell(p);
    case 'liquidity':
      return interpretLiquidity(p, asOf);
    case 'holder-distribution':
      return interpretHolders(p);
    case 'related-wallets':
      return interpretRelated(p);
    case 'program-verification':
      return interpretProgram(p);
    default:
      return { status: 'UNKNOWN', claim: `Unknown check ${kind}` };
  }
}
