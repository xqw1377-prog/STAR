import type { BookFact, LaunchEvent, UniverseInstanceId } from './types';

/** Attention spike. Opaque label — Core does not forecast the next meme. */
export interface WorldEvent {
  id: string;
  label: string;
  observedAt: string;
  attention: number;
}

/** 叙事的生命周期阶段。S0–S3 为社交维度（当前社交源 BLOCKED 不可观测），S4–S8 由 on-chain 证据驱动。 */
export const NARRATIVE_STAGES = [
  'S0-EVENT',
  'S1-SEED',
  'S2-SPREAD',
  'S3-CONSENSUS',
  'S4-ASSETIZATION',
  'S5-LIQUIDITY',
  'S6-SPECULATION',
  'S7-CONSENSUS-PEAK',
  'S8-DECAY',
] as const;

export type NarrativeStage = (typeof NARRATIVE_STAGES)[number];

export interface Narrative {
  id: string;
  eventId: string;
  label: string;
  observedAt: string;
  /**
   * 生命周期阶段。`undefined` 表示尚未被任何证据锚定（UNKNOWN），
   * 由 lifecycle 状态机推进，never 臆测。见 lib/alpha/narrative/lifecycle.ts。
   */
  stage?: NarrativeStage;
}

export interface MoneyFact {
  assetId: string;
  earlyWallets: number | null;
  buyPressure: number | null;
  flowIn: boolean | null;
}

/** The object STAR hunts: narrative becoming an asset with a market and money. */
export interface EarlySignal {
  event: WorldEvent;
  narrative: Narrative;
  assetId: string;
  market: UniverseInstanceId;
  launch: LaunchEvent;
  book?: BookFact;
  money: MoneyFact;
}
