import { THRESHOLDS } from './thresholds';
import type { GateStatus } from './types';

export interface InterpretResult {
  status: GateStatus;
  claim: string;
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

function interpretSell(p: Record<string, unknown>): InterpretResult {
  if (p.executable === false) return { status: 'FAIL', claim: String(p.detail ?? 'Sell path not executable') };
  const buy = p.buy as { executable?: boolean } | null | undefined;
  if (!buy) return { status: 'UNKNOWN', claim: 'Buy path unproven' };
  if (buy.executable === false) return { status: 'FAIL', claim: 'Buy path not executable' };
  return { status: 'PASS', claim: 'Buy and sell paths executable' };
}

function interpretLiquidity(p: Record<string, unknown>): InterpretResult {
  const tvl = typeof p.tvlUsdTotal === 'number' ? p.tvlUsdTotal : null;
  if (tvl == null) return { status: 'UNKNOWN', claim: 'TVL not observed' };
  if (tvl < THRESHOLDS.LIQUIDITY_MIN_TVL_USD) return { status: 'FAIL', claim: `TVL too low: $${tvl}` };
  const pools = Array.isArray(p.pools) ? (p.pools as Record<string, unknown>[]) : [];
  const locked = pools.some((pool) => {
    const burned = typeof pool.lpBurnedPct === 'number' && pool.lpBurnedPct >= THRESHOLDS.LP_BURN_MIN_PCT;
    return burned || Boolean(pool.lockedUntil);
  });
  if (!locked) return { status: 'UNKNOWN', claim: `TVL $${tvl}; LP lock/burn not proven` };
  const depth = typeof p.exitDepthUsd === 'number' ? p.exitDepthUsd : null;
  if (depth == null || depth <= 0) return { status: 'UNKNOWN', claim: 'Exit depth not observed' };
  return { status: 'PASS', claim: `TVL $${tvl}; LP locked/burned; exit depth $${depth}` };
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
  if (typeof p.clusterPct !== 'number') return { status: 'UNKNOWN', claim: 'Related-wallet cluster not observed' };
  if (p.clusterPct > THRESHOLDS.RELATED_CLUSTER_MAX_PCT) {
    return { status: 'FAIL', claim: `Related cluster ${(p.clusterPct * 100).toFixed(0)}% exceeds ${THRESHOLDS.RELATED_CLUSTER_MAX_PCT * 100}%` };
  }
  return { status: 'PASS', claim: `Related cluster ${(p.clusterPct * 100).toFixed(0)}% within threshold` };
}

function interpretProgram(p: Record<string, unknown>): InterpretResult {
  if (p.verifiedBuild === true) return { status: 'PASS', claim: 'Verified build present' };
  if (p.immutable === true) return { status: 'PASS', claim: 'Program immutable' };
  if (p.upgradeAuthority) return { status: 'FAIL', claim: `Upgradeable without verified build: ${p.upgradeAuthority}` };
  return { status: 'UNKNOWN', claim: 'Program state not provable' };
}

/** Canonical payload → gate status. UI must not reimplement these rules. */
export function interpretCheck(kind: string, payload: unknown): InterpretResult {
  const p = asRecord(payload);
  switch (kind) {
    case 'mint-authority':
    case 'token-authority':
      return interpretToken(p, 'mint');
    case 'freeze-authority':
      return interpretToken(p, 'freeze');
    case 'sell-simulation':
      return interpretSell(p);
    case 'liquidity':
      return interpretLiquidity(p);
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
