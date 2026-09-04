/**
 * Deterministic synthetic corpus (real = 0). Expected values come from the
 * independent oracle, not from production interpret/gates/engine.
 */
import { oracleEvaluate } from './oracle';
import * as p from './payloads';
import type { CorpusCase, CorpusFact, GateName, Partition } from './types';
import { GATE_NAMES } from './types';

export const CORPUS_SEED = 20260903;
export const CORPUS_SYNTHETIC = 150;
export const CORPUS_REAL = 0;

export const CORPUS_PARTITION: Record<string, Partition> = {
  'F-ALL-PASS': 'calibration',
  'F-UNK-token-permissions': 'calibration',
  'F-UNK-tradability': 'calibration',
  'F-UNK-liquidity': 'validation',
  'F-UNK-concentration': 'validation',
  'F-UNK-related-wallets': 'calibration',
  'F-UNK-program-verification': 'validation',
  'F-FAIL-token-permissions': 'validation',
  'F-FAIL-tradability': 'calibration',
  'F-FAIL-liquidity': 'calibration',
  'F-FAIL-concentration': 'validation',
  'F-FAIL-related-wallets': 'validation',
  'F-FAIL-program-verification': 'calibration',
  'F-RUG-MINT': 'validation',
  'F-RUG-LP-PULL': 'calibration',
  'F-HONEYPOT-SELL': 'calibration',
  'F-FREEZE-ABUSE': 'validation',
  'F-LIQUIDITY-DEATH': 'calibration',
  'F-ATTENTION-FADE': 'validation',
  'F-MANIPULATED-VOLUME': 'calibration',
};

const NARRATIVES = ['inscriptions', 'solana-meme', 'ai-agent'] as const;

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function at(t0: Date, days: number, hours = 0): string {
  return new Date(t0.getTime() + days * 86400000 + hours * 3600000).toISOString();
}

function fact(kind: string, payload: unknown, when: string, source = 'synthetic'): CorpusFact {
  return {
    kind,
    observedAt: when,
    effectiveAt: when,
    ingestedAt: new Date(Date.parse(when) + 3600000).toISOString(),
    source,
    payload,
  };
}

function pack(
  kinds: Record<string, unknown>,
  when: string,
): CorpusFact[] {
  const mint = kinds['mint-authority'] ?? p.tokenClean();
  const freeze = kinds['freeze-authority'] ?? mint;
  return [
    fact('mint-authority', mint, when),
    fact('freeze-authority', freeze, when),
    fact('sell-simulation', kinds['sell-simulation'] ?? p.sellOk(), when),
    fact('liquidity', kinds.liquidity ?? p.liqOk(), when),
    fact('holder-distribution', kinds['holder-distribution'] ?? p.holdersOk(), when),
    fact('related-wallets', kinds['related-wallets'] ?? p.relatedOk(), when),
    fact('program-verification', kinds['program-verification'] ?? p.progOk(), when),
  ];
}

function mutateGate(gate: GateName, verdict: 'FAIL' | 'UNKNOWN'): Record<string, unknown> {
  if (gate === 'token-permissions') {
    return verdict === 'FAIL' ? { 'mint-authority': p.tokenMintLive(), 'freeze-authority': p.tokenMintLive() } : { 'mint-authority': p.tokenUnresolved(), 'freeze-authority': p.tokenUnresolved() };
  }
  if (gate === 'tradability') return { 'sell-simulation': verdict === 'FAIL' ? p.sellBlocked() : p.sellNoImpact() };
  if (gate === 'liquidity') return { liquidity: verdict === 'FAIL' ? p.liqThin() : p.liqNoLock() };
  if (gate === 'concentration') return { 'holder-distribution': verdict === 'FAIL' ? p.holdersConc() : p.holdersNoAdj() };
  if (gate === 'related-wallets') return { 'related-wallets': verdict === 'FAIL' ? p.relatedHot() : p.relatedNoGraph() };
  return { 'program-verification': verdict === 'FAIL' ? p.progUpgrade() : p.progUnparsed() };
}

function finish(partial: Omit<CorpusCase, 'expected'>, seed: number): CorpusCase {
  const expected = oracleEvaluate({
    facts: partial.facts,
    cutoff: partial.decision_cutoff,
    lifecycle: partial.lifecycle,
    t0: partial.t0,
    narrativeScores: partial.narrativeScores,
  });
  return { ...partial, generator_seed: seed, expected };
}

export function generateCorpus(seed = CORPUS_SEED): CorpusCase[] {
  const rnd = mulberry32(seed);
  const cases: CorpusCase[] = [];
  let i = 0;

  const nextMeta = (family: string, cohort: CorpusCase['cohort'], lifecycle = 'VERIFIED') => {
    const idx = i++;
    const t0 = new Date(Date.UTC(2026, 0, 1 + idx));
    const jitter = 0.55 + rnd() * 0.3;
    return {
      sample_id: `syn-${String(idx + 1).padStart(3, '0')}`,
      cohort,
      narrative: NARRATIVES[idx % 3],
      family_id: family,
      t0: t0.toISOString(),
      decision_cutoff: at(t0, 7),
      lifecycle,
      narrativeScores: {
        novelty: jitter,
        velocity: 0.5 + rnd() * 0.3,
        breadth: 0.45 + rnd() * 0.3,
        onChainConfirm: 0.6 + rnd() * 0.25,
        survival: 0.55 + rnd() * 0.3,
        updatedAt: t0.toISOString(),
      },
      t0Date: t0,
    };
  };

  const push = (
    family: string,
    cohort: CorpusCase['cohort'],
    kinds: Record<string, unknown>,
    opts?: { lifecycle?: string; mechanism?: string | null; hindsight?: CorpusFact[] },
  ) => {
    const meta = nextMeta(family, cohort, opts?.lifecycle);
    const when = at(meta.t0Date, 1);
    const facts = pack(kinds, when);
    const hindsight = opts?.hindsight ?? [
      fact('mint-authority', cohort === 'SUCCESS' ? p.tokenMintLive() : p.tokenClean(), at(meta.t0Date, 14)),
      fact('freeze-authority', cohort === 'SUCCESS' ? p.tokenMintLive() : p.tokenClean(), at(meta.t0Date, 14)),
    ];
    cases.push(finish({
      sample_id: meta.sample_id,
      cohort: meta.cohort,
      narrative: meta.narrative,
      family_id: meta.family_id,
      t0: meta.t0,
      decision_cutoff: meta.decision_cutoff,
      lifecycle: meta.lifecycle,
      narrativeScores: meta.narrativeScores,
      facts,
      hindsight,
      failure_mechanism: opts?.mechanism ?? null,
      generator_seed: seed,
    }, seed));
  };

  for (let n = 0; n < 14; n++) {
    push('F-ALL-PASS', 'SUCCESS', { liquidity: p.liqOk(350000 + n * 15000) }, { mechanism: n < 4 ? 'MANIPULATED_VOLUME' : null });
  }

  for (const gate of GATE_NAMES) {
    for (let n = 0; n < 6; n++) {
      push(`F-UNK-${gate}`, 'SUCCESS', mutateGate(gate, 'UNKNOWN'));
    }
  }

  for (const gate of GATE_NAMES) {
    for (let n = 0; n < 8; n++) {
      const mechanism = gate === 'token-permissions' ? 'RUG_MINT'
        : gate === 'tradability' ? 'HONEYPOT_SELL'
        : gate === 'liquidity' ? 'RUG_LP_PULL'
        : gate === 'concentration' ? 'MANIPULATED_VOLUME'
        : gate === 'related-wallets' ? 'MANIPULATED_VOLUME'
        : 'RUG_MINT';
      push(`F-FAIL-${gate}`, 'FAIL', mutateGate(gate, 'FAIL'), { mechanism });
    }
  }

  for (let n = 0; n < 10; n++) {
    push('F-RUG-MINT', 'FAIL', { 'mint-authority': p.tokenMintLive(), 'freeze-authority': p.tokenMintLive(), liquidity: p.liqThin() }, { mechanism: 'RUG_MINT' });
  }
  for (let n = 0; n < 10; n++) {
    push('F-RUG-LP-PULL', 'FAIL', { liquidity: p.liqThin() }, { mechanism: 'RUG_LP_PULL' });
  }
  for (let n = 0; n < 10; n++) {
    push('F-HONEYPOT-SELL', 'FAIL', { 'sell-simulation': p.sellBlocked() }, { mechanism: 'HONEYPOT_SELL' });
  }
  for (let n = 0; n < 8; n++) {
    push('F-FREEZE-ABUSE', 'FAIL', { 'mint-authority': p.tokenFreezeLive(), 'freeze-authority': p.tokenFreezeLive() }, { mechanism: 'FREEZE_ABUSE' });
  }
  for (let n = 0; n < 8; n++) {
    push('F-LIQUIDITY-DEATH', 'FAIL', { liquidity: p.liqShallowExit() }, { mechanism: 'LIQUIDITY_DEATH' });
  }
  for (let n = 0; n < 6; n++) {
    push('F-ATTENTION-FADE', 'FAIL', { liquidity: p.liqOk(280000 + n * 10000) }, { lifecycle: 'CROWDING', mechanism: 'ATTENTION_FADE' });
  }

  if (cases.length !== CORPUS_SYNTHETIC) {
    throw new Error(`corpus size ${cases.length} != ${CORPUS_SYNTHETIC}`);
  }
  return cases;
}

export function corpusStats(cases: CorpusCase[]) {
  const cover: Record<string, Record<string, number>> = {};
  for (const g of GATE_NAMES) cover[g] = { PASS: 0, FAIL: 0, UNKNOWN: 0 };
  let successAllPass = 0;
  let failPartial = 0;
  for (const c of cases) {
    for (const g of GATE_NAMES) cover[g][c.expected.gates[g]] += 1;
    if (c.cohort === 'SUCCESS' && GATE_NAMES.every((g) => c.expected.gates[g] === 'PASS') && (c.expected.score_total ?? 0) > 0) {
      successAllPass += 1;
    }
    if (c.cohort === 'FAIL') {
      const passN = GATE_NAMES.filter((g) => c.expected.gates[g] === 'PASS').length;
      const failN = GATE_NAMES.filter((g) => c.expected.gates[g] === 'FAIL').length;
      if (passN >= 1 && failN === 1) failPartial += 1;
    }
  }
  return {
    synthetic: cases.length,
    real: CORPUS_REAL,
    success: cases.filter((c) => c.cohort === 'SUCCESS').length,
    fail: cases.filter((c) => c.cohort === 'FAIL').length,
    cover,
    successAllPass,
    failPartial,
  };
}
