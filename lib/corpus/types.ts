export type GateName =
  | 'token-permissions'
  | 'tradability'
  | 'liquidity'
  | 'concentration'
  | 'related-wallets'
  | 'program-verification';

export type Verdict = 'PASS' | 'FAIL' | 'UNKNOWN';
export type Cohort = 'SUCCESS' | 'FAIL';
export type Readiness = 'BLOCKED' | 'RESEARCH_REQUIRED' | 'READY' | 'TOO_LATE';
export type Partition = 'calibration' | 'validation';

export type CorpusFact = {
  kind: string;
  observedAt: string;
  effectiveAt: string;
  ingestedAt: string;
  source: string;
  payload: unknown;
};

export type OracleExpected = {
  gates: Record<GateName, Verdict>;
  readiness: Readiness;
  score_total: number | null;
};

export type CorpusCase = {
  sample_id: string;
  cohort: Cohort;
  narrative: 'inscriptions' | 'solana-meme' | 'ai-agent';
  family_id: string;
  t0: string;
  decision_cutoff: string;
  lifecycle: string;
  narrativeScores: {
    novelty: number;
    velocity: number;
    breadth: number;
    onChainConfirm: number;
    survival: number;
    updatedAt: string;
  };
  facts: CorpusFact[];
  hindsight: CorpusFact[];
  failure_mechanism: string | null;
  generator_seed: number;
  expected: OracleExpected;
};

export const GATE_NAMES: GateName[] = [
  'token-permissions',
  'tradability',
  'liquidity',
  'concentration',
  'related-wallets',
  'program-verification',
];
