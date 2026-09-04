import { evaluateFactsAsOf } from '@/lib/engine';
import type { CorpusCase, CorpusFact, OracleExpected } from './types';
import { GATE_NAMES } from './types';

export function engineEvaluate(c: CorpusCase, facts: CorpusFact[] = c.facts): OracleExpected {
  const ev = evaluateFactsAsOf({
    projectId: c.sample_id,
    asOf: new Date(c.decision_cutoff),
    lifecycle: c.lifecycle,
    discoveredAt: new Date(c.t0),
    narrative: {
      ...c.narrativeScores,
      updatedAt: new Date(c.narrativeScores.updatedAt),
    },
    rows: facts.map((f, idx) => ({
      id: `${c.sample_id}-${f.kind}-${idx}`,
      type: f.kind,
      observedAt: new Date(f.observedAt),
      effectiveAt: new Date(f.effectiveAt),
      ingestedAt: new Date(f.ingestedAt),
      source: f.source,
      payload: f.payload,
      conclusion: f.kind,
    })),
  });
  const gates = Object.fromEntries(
    GATE_NAMES.map((g) => [g, ev.gates.find((x) => x.gate === g)?.status ?? 'UNKNOWN']),
  ) as OracleExpected['gates'];
  return {
    gates,
    readiness: ev.readiness,
    score_total: ev.score ? ev.score.total : null,
  };
}
