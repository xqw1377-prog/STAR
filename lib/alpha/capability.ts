/**
 * STAR Core is chain-agnostic. Runtime is locked to U-01-SOLANA.
 */
import { SNIPE_STRATEGY_ID } from '@/lib/alpha/strategy/snipe-v0';
import { resolveExecutionMode } from '@/lib/alpha/execution/mode';
import { STAR_LOOP, STAR_ROLES } from '@/lib/alpha/layers';
import { jupiterExecuteAllowed } from '@/lib/alpha/execution/jupiter-ultra';
import { MARKET_RADAR } from '@/lib/alpha/markets/registry';

export const CAPABILITY_LEDGER_ID = 'star-capability@7' as const;

export const CAPABILITY = {
  id: CAPABILITY_LEDGER_ID,
  purpose: 'EARLY-MARKET-RESPONSE',
  product: '新叙事早期资产阻击引擎',
  model: 'EVENT-NARRATIVE-ASSET-MARKET-MONEY',
  portfolio: 'portfolio-policy@v1-convex',
  loop: STAR_LOOP,
  universeClass: MARKET_RADAR.class,
  universeClassName: MARKET_RADAR.className,
  activeUniverse: MARKET_RADAR.selected,
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
  roles: {
    discovery: { ...STAR_ROLES.discovery, status: 'LEGAL-REVIEW' },
    decision: { ...STAR_ROLES.decision, status: 'IN-PROGRESS' },
    truth: { ...STAR_ROLES.truth, status: 'BLOCKED' },
    execution: { ...STAR_ROLES.execution, status: 'ADAPTER-LOCKED' },
    exit: { ...STAR_ROLES.exit, status: 'IN-PROGRESS' },
  },
  radar: MARKET_RADAR.boards,
  operatingModel: 'CONSENSUS-OPERATING-MODEL FROZEN-rev1',
  runtime: {
    enabledSources: ['synthetic-fixtures'] as const,
    solanaRpc: 'BLOCKED',
    aveAi: 'LEGAL_REVIEW',
    jupiterUltra: 'LEGAL_REVIEW',
    b1: {
      recorder: 'b1-recorder@1',
      /** B1-ACTIVE = Recording Active / Sensor OFF (principal ruling 2026-09-05). */
      status: 'ACTIVE-FIXTURE-ONLY',
      realSensor: false,
      decisionReachable: false,
    },
    m1: {
      observation: 'star-observation@1',
      /** M1 READY = fixture/replay observation infrastructure verified; Real Sensor OFF (principal authorization 2026-09-05). */
      status: 'READY-FIXTURE-REPLAY-ONLY',
      realSensor: false,
      realRpc: false,
      b2Authorized: false,
    },
    m2: {
      engine: 'star-actor@1',
      /** Pure evidence organs — emit M0-contract records, no DB writes, no risk scores. */
      status: 'READY-FIXTURE-ONLY',
      emitsEvidence: true,
      emitsRiskScore: false,
      wiredToRuntime: false,
    },
    m3: {
      engine: 'star-tokenrisk@1',
      status: 'READY-FIXTURE-ONLY',
      emitsEvidence: true,
      emitsRiskScore: false,
      wiredToRuntime: false,
    },
    m4: {
      engine: 'star-eventintel@1',
      status: 'READY-FIXTURE-ONLY',
      emitsEvidence: true,
      narrativeIdentity: false,
      wiredToRuntime: false,
    },
    m5: {
      audit: 'm5-integration@1',
      /** Integration & governance audit PASSED at fixture scope (2026-09-05): provenance, leakage, poisoning, registry. */
      status: 'PASSED-FIXTURE-SCOPE',
      realRpc: false,
      b2Authorized: false,
    },
    strategy: SNIPE_STRATEGY_ID,
    autoTrade: true,
    executionDefault: 'DRY_RUN',
    snipeCycleWired: true,
    snipeLoop: 'process-interval',
    deskRequiresResearchDb: false,
    walletModule: false,
    broadcast: false,
    jupiterExecute: false,
    jupiterDecidesEntry: false,
    aveDecidesEntry: false,
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
    product: CAPABILITY.product,
    model: CAPABILITY.model,
    portfolio: CAPABILITY.portfolio,
    loop: CAPABILITY.loop,
    universeClass: CAPABILITY.universeClass,
    universeClassName: CAPABILITY.universeClassName,
    activeUniverse: CAPABILITY.activeUniverse,
    money: CAPABILITY.money,
    research: CAPABILITY.research,
    paper: CAPABILITY.paper,
    roles: CAPABILITY.roles,
    radar: CAPABILITY.radar,
    runtime: {
      ...CAPABILITY.runtime,
      executionMode: resolveExecutionMode(),
      jupiterExecuteArmed: jupiterExecuteAllowed(),
    },
  };
}
