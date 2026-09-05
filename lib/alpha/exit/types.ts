export type ExitKind =
  | 'TAKE_PROFIT'
  | 'STOP_LOSS'
  | 'TRAILING'
  | 'TIME_EXIT'
  | 'RISK_EXIT'
  | 'LIQUIDITY_EXIT'
  | 'THESIS_BROKEN'
  | 'EXIT_IMPOSSIBLE'
  | 'HOLD';

export interface ExitPlan {
  liquidityFloorSol: number;
  maxHoldSlots: number;
  takeProfitBps: number | null;
  stopLossBps: number | null;
  trailingBps: number | null;
}
