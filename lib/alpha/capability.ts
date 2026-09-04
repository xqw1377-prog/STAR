/**
 * Single runtime ledger for what STAR can do *in this tree*.
 * Paper policy (worksheets) and runtime code are listed separately so
 * README / contract / UI cannot claim a capability the binary does not have.
 */
export const CAPABILITY_LEDGER_ID = 'star-capability@1' as const;

export const CAPABILITY = {
  id: CAPABILITY_LEDGER_ID,
  money: 'NO-EVIDENCE',
  research: 'PARTIAL',
  paper: {
    m0Objective: 'FROZEN',
    m0Measurement: 'FROZEN-rev1',
    m0Boundary: 'FROZEN-rev2',
    m1Build: 'IN-PROGRESS',
    m1Evidence: 'NOT-STARTED',
    m2: 'NOT-STARTED',
    m3: 'DENIED',
    m4: 'DENIED',
    m5Build: 'AUTHORIZED-PAPER',
    m5Evidence: 'DENIED',
    m6: 'DENIED',
    fundPolicy: 'MICRO-LIVE-CANDIDATE',
    fundCapUsdc: 1000,
    p1: 'NO-GO',
  },
  runtime: {
    enabledSources: ['synthetic-fixtures'] as const,
    solanaRpc: 'BLOCKED',
    walletModule: false,
    broadcast: false,
    autoTrade: false,
    recorderWiredToApi: false,
    recorderWiredToUi: false,
    browserDb: 'idb://star',
    serverDb: '.pglite',
    storesCoupled: false,
    refreshCollectsChain: false,
    decisionIntentExecutable: false,
    portfolioNavComputed: false,
  },
} as const;

export type CapabilityLedger = typeof CAPABILITY;

export function capabilityPublic() {
  return {
    id: CAPABILITY.id,
    money: CAPABILITY.money,
    research: CAPABILITY.research,
    paper: CAPABILITY.paper,
    runtime: CAPABILITY.runtime,
  };
}
