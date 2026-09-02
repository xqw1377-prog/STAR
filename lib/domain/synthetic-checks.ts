import type { CheckObservation } from './gates';
import type { GateStatus } from './types';

function row(
  project_id: string,
  check: string,
  status: GateStatus,
  at: string,
  claim: string,
  id: string,
): CheckObservation {
  return {
    id,
    project_id,
    check,
    status,
    claim,
    source: 'fixture',
    source_kind: 'fixture',
    effective_at: at,
    observed_at: at,
    ingested_at: at,
    confidence: 0.9,
  };
}

export const NEURAL_CHECKS: CheckObservation[] = [
  row('proj-neural', 'mint-authority', 'FAIL', '2026-08-15T00:00:00Z', 'mint live', 'n-mint-1'),
  row('proj-neural', 'freeze-authority', 'FAIL', '2026-08-15T00:00:00Z', 'freeze live', 'n-frz-1'),
  row('proj-neural', 'liquidity', 'FAIL', '2026-08-16T00:00:00Z', 'TVL thin', 'n-liq-1'),
  row('proj-neural', 'holder-distribution', 'FAIL', '2026-08-16T00:00:00Z', 'top10 62%', 'n-hld-1'),
  row('proj-neural', 'mint-authority', 'PASS', '2026-08-18T00:00:00Z', 'mint revoked', 'n-mint-2'),
  row('proj-neural', 'freeze-authority', 'PASS', '2026-08-18T00:00:00Z', 'freeze revoked', 'n-frz-2'),
  row('proj-neural', 'liquidity', 'PASS', '2026-08-22T00:00:00Z', 'LP burned 85%', 'n-liq-2'),
  row('proj-neural', 'sell-simulation', 'PASS', '2026-08-22T00:00:00Z', 'buy and sell ok', 'n-sell-1'),
  row('proj-neural', 'program-verification', 'PASS', '2026-08-22T00:00:00Z', 'verified build', 'n-prg-1'),
  row('proj-neural', 'holder-distribution', 'PASS', '2026-08-24T00:00:00Z', 'entity top10 31%', 'n-hld-2'),
  row('proj-neural', 'related-wallets', 'PASS', '2026-08-24T00:00:00Z', 'no blocking control', 'n-wal-1'),
];

export const LLM_LAB_CHECKS: CheckObservation[] = [
  row('proj-llm-lab', 'mint-authority', 'PASS', '2026-08-20T00:00:00Z', 'no mint', 'l-mint'),
  row('proj-llm-lab', 'freeze-authority', 'PASS', '2026-08-20T00:00:00Z', 'no freeze', 'l-frz'),
  row('proj-llm-lab', 'sell-simulation', 'PASS', '2026-08-20T00:00:00Z', 'paths ok', 'l-sell'),
  row('proj-llm-lab', 'liquidity', 'PASS', '2026-08-20T00:00:00Z', 'LP locked', 'l-liq'),
  row('proj-llm-lab', 'holder-distribution', 'PASS', '2026-08-20T00:00:00Z', 'entity top10 31%', 'l-hld'),
  row('proj-llm-lab', 'program-verification', 'PASS', '2026-08-20T00:00:00Z', 'verified', 'l-prg'),
  row('proj-llm-lab', 'related-wallets', 'FAIL', '2026-08-20T00:00:00Z', 'team cluster 55%', 'l-wal'),
];

export const ROCKET_CHECKS: CheckObservation[] = [
  row('proj-rocket', 'mint-authority', 'FAIL', '2026-08-22T00:00:00Z', 'owner mint', 'r-mint'),
  row('proj-rocket', 'freeze-authority', 'FAIL', '2026-08-22T00:00:00Z', 'owner freeze', 'r-frz'),
  row('proj-rocket', 'holder-distribution', 'FAIL', '2026-08-22T00:00:00Z', 'top10 71%', 'r-hld'),
  row('proj-rocket', 'liquidity', 'UNKNOWN', '2026-08-22T00:00:00Z', 'LP lock unproven', 'r-liq'),
];

export const HONEYPOT_CHECKS: CheckObservation[] = [
  row('proj-honeypot', 'mint-authority', 'FAIL', '2026-08-25T00:00:00Z', 'mint live', 'h-mint'),
  row('proj-honeypot', 'freeze-authority', 'FAIL', '2026-08-25T00:00:00Z', 'freeze live', 'h-frz'),
  row('proj-honeypot', 'sell-simulation', 'FAIL', '2026-08-25T00:00:00Z', 'sell path broken', 'h-sell'),
  row('proj-honeypot', 'liquidity', 'FAIL', '2026-08-25T00:00:00Z', 'TVL too low', 'h-liq'),
  row('proj-honeypot', 'related-wallets', 'FAIL', '2026-08-25T00:00:00Z', 'cluster 70%', 'h-wal'),
];
