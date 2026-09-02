/**
 * Unique domain types (D2/D3). kebab-case only.
 * PRD_GATE_ALIAS is display/boundary text, not a second type system.
 */

export const lifecycleStages = [
  'SEED', 'IGNITION', 'VERIFIED', 'ACCELERATION', 'CROWDING', 'DISTRIBUTION', 'DEAD',
] as const;
export type LifecycleStage = (typeof lifecycleStages)[number];

/** Evidence check keys — one-to-one with contract FACT_KINDS (DATA-005). */
export const checkKeys = [
  'mint-authority',
  'freeze-authority',
  'sell-simulation',
  'liquidity',
  'holder-distribution',
  'related-wallets',
  'program-verification',
] as const;
export type CheckKey = (typeof checkKeys)[number];

export const gateStatuses = ['PASS', 'FAIL', 'UNKNOWN'] as const;
export type GateStatus = (typeof gateStatuses)[number];

export const sourceKinds = ['CHAIN', 'CODE', 'SIMULATION', 'SYNTHETIC'] as const;
export type SourceKind = (typeof sourceKinds)[number];

export type Evidence = {
  id: string;
  checkKey: CheckKey;
  claim: string;
  source: string;
  sourceKind: SourceKind;
  effectiveAt: string;
  observedAt: string;
  ingestedAt: string;
  confidence: number;
};

/** PRD §06 Solana gate groups. Each check key belongs to exactly one gate.
 *  Mint/freeze are checks INSIDE token-permissions; related-wallets is an
 *  independent gate and cannot be substituted by a holder PASS. */
export const gateKeys = [
  'token-permissions',
  'tradability',
  'liquidity',
  'concentration',
  'related-wallets',
  'program-verification',
] as const;
export type GateKey = (typeof gateKeys)[number];

export const GATE_CHECKS: Record<GateKey, CheckKey[]> = {
  'token-permissions': ['mint-authority', 'freeze-authority'],
  tradability: ['sell-simulation'],
  liquidity: ['liquidity'],
  concentration: ['holder-distribution'],
  'related-wallets': ['related-wallets'],
  'program-verification': ['program-verification'],
};

export const CHECK_TO_GATE: Record<CheckKey, GateKey> = Object.fromEntries(
  (Object.keys(GATE_CHECKS) as GateKey[]).flatMap((gate) =>
    GATE_CHECKS[gate].map((check) => [check, gate] as const),
  ),
) as Record<CheckKey, GateKey>;

/** PRD §06 names for display only. Do not persist or type against these. */
export const PRD_GATE_ALIAS = {
  'token-permissions': 'TOKEN_PERMISSIONS',
  tradability: 'BUY_SELL_SIMULATION',
  liquidity: 'LIQUIDITY_EXIT',
  concentration: 'HOLDER_CONCENTRATION',
  'related-wallets': 'ASSOCIATED_WALLETS',
  'program-verification': 'PROGRAM_VERIFICATION',
} as const;

export type Narrative = {
  id: string;
  slug: string;
  name: string;
  chain: 'Solana';
  stage: LifecycleStage;
  thesis: string;
  velocity: number;
  breadth: number;
  onchainConfirmation: number;
  observedAt: string;
};

export type Project = {
  id: string;
  slug: string;
  narrativeId: string;
  name: string;
  symbol: string;
  chain: 'Solana';
  fixtureLabel: 'SYNTHETIC_FIXTURE';
  firstObservedAt: string;
  summary: string;
};

export type OpportunityInputs = {
  narrative: number;
  teamProduct: number;
  capitalHolders: number;
  marketStructure: number;
  lifecycleFit: number;
};

export type GateCheck = {
  key: CheckKey;
  status: GateStatus;
  evidence?: Evidence;
};

export type GateAssessment = {
  status: GateStatus;
  checks: GateCheck[];
  completeness: number;
  assessedAt: string;
};

export type OpportunityAssessment = {
  score: number | null;
  confidence: number;
  freshness: number;
  inputs: OpportunityInputs;
  readiness: 'BLOCKED' | 'RESEARCH_REQUIRED' | 'READY' | 'TOO_LATE';
};

export type ProjectAudit = {
  project: Project;
  narrative: Narrative;
  gate: GateAssessment;
  opportunity: OpportunityAssessment;
  evidence: Evidence[];
};
