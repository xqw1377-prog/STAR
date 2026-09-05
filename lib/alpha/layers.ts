/** Core roles. Providers are plugged in by a Market Adapter, not hard-wired here. */
export const STAR_ROLES = {
  discovery: { id: 'discovery-provider', job: 'CANDIDATE_ONLY', decidesEntry: false },
  decision: { id: 'star-decision', job: 'ENTRY_WINDOW', decidesEntry: true },
  truth: { id: 'market-truth', job: 'VERIFY_FACTS', decidesEntry: false },
  execution: { id: 'execution-adapter', job: 'ORDER_EXECUTE', decidesEntry: false },
  exit: { id: 'star-exit', job: 'EXIT_WINDOW', decidesExit: true },
} as const;

export const STAR_LOOP = 'EVENT-NARRATIVE-ASSET-MARKET-MONEY-DECISION' as const;
