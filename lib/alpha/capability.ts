/**
 * Single live ledger. Direction: automated on-chain meme snipe.
 * Paper vs runtime stay separate. Tests/pages ≠ Alpha.
 */
import { SNIPE_STRATEGY_ID } from '@/lib/alpha/strategy/snipe-v0';
import { resolveExecutionMode } from '@/lib/alpha/execution/mode';

export const CAPABILITY_LEDGER_ID = 'star-capability@3' as const;

export const CAPABILITY = {
  id: CAPABILITY_LEDGER_ID,
  purpose: 'MEME-SNIPE-AUTO',
  money: 'NO-EVIDENCE',
  research: 'SHELL-ONLY',
  paper: {
    m0Objective: 'SUPERSEDED-BY-DIRECTION',
    m0Measurement: 'FROZEN-rev1',
    m0Boundary: 'FROZEN-rev2',
    m5Build: 'IN-PROGRESS',
    m5Evidence: 'DENIED',
    fundPolicy: 'MICRO-LIVE-CANDIDATE',
    fundCapUsdc: 1000,
    p1: 'NO-GO',
  },
  runtime: {
    enabledSources: ['synthetic-fixtures'] as const,
    solanaRpc: 'BLOCKED',
    strategy: SNIPE_STRATEGY_ID,
    autoTrade: true,
    executionDefault: 'DRY_RUN',
    snipeCycleWired: true,
    snipeLoop: 'process-interval',
    deskRequiresResearchDb: false,
    walletModule: false,
    broadcast: false,
    recorderWiredToApi: false,
    refreshCollectsChain: false,
    browserDb: 'idb://star',
    serverDb: '.pglite',
    storesCoupled: false,
  },
} as const;

export function capabilityPublic() {
  return {
    id: CAPABILITY.id,
    purpose: CAPABILITY.purpose,
    money: CAPABILITY.money,
    research: CAPABILITY.research,
    paper: CAPABILITY.paper,
    runtime: {
      ...CAPABILITY.runtime,
      executionMode: resolveExecutionMode(),
    },
  };
}
