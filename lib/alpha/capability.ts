/**
 * STAR Core is chain-agnostic. Runtime is locked to U-01-SOLANA.
 */
import { SNIPE_STRATEGY_ID } from '@/lib/alpha/strategy/snipe-v0';
import { resolveExecutionMode } from '@/lib/alpha/execution/mode';
import { STAR_LOOP, STAR_ROLES } from '@/lib/alpha/layers';
import { jupiterExecuteAllowed } from '@/lib/alpha/execution/jupiter-ultra';
import { MARKET_RADAR } from '@/lib/alpha/markets/registry';

export const CAPABILITY_LEDGER_ID = 'star-capability@6' as const;

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
  runtime: {
    enabledSources: ['synthetic-fixtures'] as const,
    solanaRpc: 'BLOCKED',
    aveAi: 'LEGAL_REVIEW',
    jupiterUltra: 'LEGAL_REVIEW',
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
