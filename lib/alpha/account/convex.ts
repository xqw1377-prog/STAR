/**
 * Convex / fat-tail policy. New experiment — does not rewrite frozen B1 v0.
 * Aim: do not miss the rare large winner; cap each miss.
 */
export const CONVEX_POLICY_ID = 'portfolio-policy@v1-convex' as const;

export const CONVEX_POLICY = {
  id: CONVEX_POLICY_ID,
  parent: 'portfolio-policy@v0-rev1',
  objective: 'FAT-TAIL',
  requireHighWinRate: false,
  acceptHighMissRate: true,
  maxNameWeight: 0.005,
  maxPositions: 5,
  sameAssetPositions: 1,
  leverage: 0,
  lossCap: 'name-notional',
} as const;
