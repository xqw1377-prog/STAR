export const RULE_VERSION = 'gates@2' as const;

export const THRESHOLDS = {
  LIQUIDITY_MIN_TVL_USD: 150_000,
  LP_BURN_MIN_PCT: 0.5,
  HOLDER_ENTITY_TOP10_MAX: 0.35,
  RELATED_CLUSTER_MAX_PCT: 0.25,
} as const;
