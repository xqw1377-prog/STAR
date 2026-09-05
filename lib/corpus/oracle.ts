/**
 * Independent calibration oracle. Second implementation of gate + readiness
 * + score from the written contract. Must not import production interpret,
 * gates, production threshold constants, or engine (enforced by P1D-T17).
 */
import type { CorpusCase, CorpusFact, GateName, OracleExpected, Verdict } from './types';
import { GATE_NAMES } from './types';

const TVL_FLOOR = 150000;
const BURN_FLOOR = 1 / 2;
const EXIT_FLOOR = 25000;
const TOP10_CAP = 35 / 100;
const CLUSTER_CAP = 25 / 100;
const W_NARR = 1 / 4;
const W_TEAM = 1 / 5;
const W_CAP = 1 / 5;
const W_MKT = 1 / 5;
const W_LIFE = 3 / 20;

function rec(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
}

function privileges(p: Record<string, unknown>): boolean {
  return Boolean(
    p.mintAuthority
    || p.freezeAuthority
    || p.transferHook
    || p.permanentDelegate
    || p.feeConfig
    || (Array.isArray(p.token2022Extensions) && p.token2022Extensions.length),
  );
}

function tokenVerdict(p: Record<string, unknown>): Verdict {
  if (privileges(p)) return 'FAIL';
  if (p.token2022Extensions == null) return 'UNKNOWN';
  return 'PASS';
}

function missingImpact(v: unknown): boolean {
  return v == null || (typeof v === 'number' && Number.isNaN(v));
}

function sellVerdict(_p: Record<string, unknown>): Verdict {
  // F2-A: the adapter executable verdict is gone and the governed E-01
  // interpreter is not yet authorized (F2-B). Calibration truth may not use
  // ungoverned judgments, so tradability calibrates as UNKNOWN until F2-B.
  void _p;
  return 'UNKNOWN';
}

function lockActive(pool: Record<string, unknown>, asOfMs: number): boolean {
  if (typeof pool.lpBurnedPct === 'number' && pool.lpBurnedPct >= BURN_FLOOR) return true;
  if (typeof pool.lockedUntil !== 'string' || !pool.lockedUntil) return false;
  const until = Date.parse(pool.lockedUntil);
  return Number.isFinite(until) && until > asOfMs;
}

function liqVerdict(p: Record<string, unknown>, asOfMs: number): Verdict {
  const tvl = typeof p.tvlUsdTotal === 'number' ? p.tvlUsdTotal : null;
  if (tvl == null) return 'UNKNOWN';
  if (tvl < TVL_FLOOR) return 'FAIL';
  const pools = Array.isArray(p.pools) ? (p.pools as Record<string, unknown>[]) : [];
  if (!pools.length) return 'UNKNOWN';
  let lockedTvl = 0;
  let sawLock = false;
  for (const pool of pools) {
    const poolTvl = typeof pool.tvlUsd === 'number' ? pool.tvlUsd : pools.length === 1 ? tvl : 0;
    if (typeof pool.lockedUntil === 'string' || typeof pool.lpBurnedPct === 'number') sawLock = true;
    if (lockActive(pool, asOfMs)) lockedTvl += poolTvl;
  }
  if (lockedTvl < TVL_FLOOR) {
    if (!sawLock || lockedTvl === 0) return 'UNKNOWN';
    return 'FAIL';
  }
  const depth = typeof p.exitDepthUsd === 'number' ? p.exitDepthUsd : null;
  if (depth == null) return 'UNKNOWN';
  if (depth < EXIT_FLOOR) return 'FAIL';
  return 'PASS';
}

function holderVerdict(p: Record<string, unknown>): Verdict {
  const adj = typeof p.top10PctEntityAdjusted === 'number' ? p.top10PctEntityAdjusted : null;
  if (adj == null) return 'UNKNOWN';
  return adj > TOP10_CAP ? 'FAIL' : 'PASS';
}

function relatedVerdict(p: Record<string, unknown>): Verdict {
  if (p.graphIngested !== true) return 'UNKNOWN';
  if (typeof p.clusterPct !== 'number') return 'UNKNOWN';
  return p.clusterPct > CLUSTER_CAP ? 'FAIL' : 'PASS';
}

function programVerdict(p: Record<string, unknown>): Verdict {
  if (p.accountParsed === false) return 'UNKNOWN';
  if (p.verifiedBuild === true && p.owner) return 'PASS';
  if (p.immutable === true && p.verifiedBuild !== true) return 'UNKNOWN';
  if (p.upgradeAuthority) return 'FAIL';
  return 'UNKNOWN';
}

function checkVerdict(kind: string, payload: unknown, asOfMs: number): Verdict {
  const p = rec(payload);
  if (kind === 'mint-authority' || kind === 'freeze-authority' || kind === 'token-authority') return tokenVerdict(p);
  if (kind === 'sell-simulation') return sellVerdict(p);
  if (kind === 'liquidity') return liqVerdict(p, asOfMs);
  if (kind === 'holder-distribution') return holderVerdict(p);
  if (kind === 'related-wallets') return relatedVerdict(p);
  if (kind === 'program-verification') return programVerdict(p);
  return 'UNKNOWN';
}

function merge(a: Verdict, b: Verdict): Verdict {
  if (a === 'FAIL' || b === 'FAIL') return 'FAIL';
  if (a === 'UNKNOWN' || b === 'UNKNOWN') return 'UNKNOWN';
  return 'PASS';
}

function latestBefore(facts: CorpusFact[], kind: string, cutoffMs: number): CorpusFact | undefined {
  return facts
    .filter((f) => f.kind === kind && Date.parse(f.observedAt) <= cutoffMs && Date.parse(f.effectiveAt) <= cutoffMs)
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt) || b.ingestedAt.localeCompare(a.ingestedAt))[0];
}

function lifeFit(stage: string): number {
  if (stage === 'SEED') return 85;
  if (stage === 'IGNITION') return 90;
  if (stage === 'VERIFIED') return 80;
  if (stage === 'ACCELERATION') return 60;
  if (stage === 'CROWDING') return 20;
  if (stage === 'DISTRIBUTION') return 5;
  if (stage === 'DEAD') return 0;
  return 50;
}

export function oracleEvaluate(input: {
  facts: CorpusFact[];
  cutoff: string;
  lifecycle: string;
  t0: string;
  narrativeScores: CorpusCase['narrativeScores'];
}): OracleExpected {
  const cutoffMs = Date.parse(input.cutoff);
  const mint = latestBefore(input.facts, 'mint-authority', cutoffMs);
  const freeze = latestBefore(input.facts, 'freeze-authority', cutoffMs);
  const sell = latestBefore(input.facts, 'sell-simulation', cutoffMs);
  const liq = latestBefore(input.facts, 'liquidity', cutoffMs);
  const holders = latestBefore(input.facts, 'holder-distribution', cutoffMs);
  const related = latestBefore(input.facts, 'related-wallets', cutoffMs);
  const prog = latestBefore(input.facts, 'program-verification', cutoffMs);

  const gates: Record<GateName, Verdict> = {
    'token-permissions': merge(
      mint ? checkVerdict('mint-authority', mint.payload, cutoffMs) : 'UNKNOWN',
      freeze ? checkVerdict('freeze-authority', freeze.payload, cutoffMs) : 'UNKNOWN',
    ),
    tradability: sell ? checkVerdict('sell-simulation', sell.payload, cutoffMs) : 'UNKNOWN',
    liquidity: liq ? checkVerdict('liquidity', liq.payload, cutoffMs) : 'UNKNOWN',
    concentration: holders ? checkVerdict('holder-distribution', holders.payload, cutoffMs) : 'UNKNOWN',
    'related-wallets': related ? checkVerdict('related-wallets', related.payload, cutoffMs) : 'UNKNOWN',
    'program-verification': prog ? checkVerdict('program-verification', prog.payload, cutoffMs) : 'UNKNOWN',
  };

  const allPass = GATE_NAMES.every((g) => gates[g] === 'PASS');
  const anyFail = GATE_NAMES.some((g) => gates[g] === 'FAIL');
  const anyUnknown = GATE_NAMES.some((g) => gates[g] === 'UNKNOWN');
  const late = input.lifecycle === 'CROWDING' || input.lifecycle === 'DISTRIBUTION' || input.lifecycle === 'DEAD';
  const readiness = anyFail ? 'BLOCKED' : anyUnknown ? 'RESEARCH_REQUIRED' : late ? 'TOO_LATE' : 'READY';

  let score_total: number | null = null;
  if (allPass && holders && related && liq && prog) {
    const hp = rec(holders.payload);
    const holdersPct = typeof hp.top10PctEntityAdjusted === 'number' ? hp.top10PctEntityAdjusted : Number(hp.top10Pct);
    const clusterPct = Number(rec(related.payload).clusterPct);
    const tvl = Number(rec(liq.payload).tvlUsdTotal);
    const verified = rec(prog.payload).verifiedBuild === true;
    const n = input.narrativeScores;
    const narrativeScore = ((n.novelty + n.velocity + n.breadth + n.onChainConfirm + n.survival) / 5) * 100;
    const parts = {
      narrative: narrativeScore,
      teamProduct: verified ? 80 : 60,
      capitalHolders: Math.max(0, Math.min(100, Math.round(100 - 120 * Math.max(holdersPct, clusterPct)))),
      marketStructure: Math.max(0, Math.min(90, Math.round((tvl / 1_000_000) * 40 + 40))),
      lifecycleFit: lifeFit(input.lifecycle),
    };
    score_total = Number((
      parts.narrative * W_NARR
      + parts.teamProduct * W_TEAM
      + parts.capitalHolders * W_CAP
      + parts.marketStructure * W_MKT
      + parts.lifecycleFit * W_LIFE
    ).toFixed(1));
  }

  return { gates, readiness, score_total };
}

export function oracleEvaluateCase(c: CorpusCase, facts = c.facts): OracleExpected {
  return oracleEvaluate({
    facts,
    cutoff: c.decision_cutoff,
    lifecycle: c.lifecycle,
    t0: c.t0,
    narrativeScores: c.narrativeScores,
  });
}
