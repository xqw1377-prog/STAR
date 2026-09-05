export const RULE_VERSION = 'gates@4' as const;

export const THRESHOLDS = {
  // E-01 (FROZEN-v1 · gates@4): pre-fee tradability interpretation
  IMPACT_MAX_PCT: 0.15,
  PRICING_LEG_MIN_RATIO: 0.80,
  LIQUIDITY_MIN_TVL_USD: 150_000,
  LP_BURN_MIN_PCT: 0.5,
  EXIT_DEPTH_MIN_USD: 25_000,
  HOLDER_ENTITY_TOP10_MAX: 0.35,
  RELATED_CLUSTER_MAX_PCT: 0.25,
} as const;
