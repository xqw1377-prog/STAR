import type { BookFact, LaunchEvent } from '@/lib/alpha/core/types';
import type { NARRATIVE_STAGES, NarrativeStage } from '@/lib/alpha/core/signal';
import type { MoneyFact } from '@/lib/alpha/core/signal';

/**
 * 叙事生命周期状态机。STAR 在 S2 → S4 工作（而不是 S6 → S7）。
 *
 * 阶段划分：
 *   S0 EVENT      现实事件（社交维度）
 *   S1 SEED       关键人物开始传播（社交维度）
 *   S2 SPREAD     传播速度抬升（社交维度）
 *   S3 CONSENSUS  命名/关键词收敛（社交维度）
 *   S4 ASSETIZATION 出现第一个 Token（on-chain：launch）
 *   S5 LIQUIDITY  资金进入（on-chain：流动性）
 *   S6 SPECULATION 聪明钱进入（on-chain：money 流入）
 *   S7 CONSENSUS_PEAK 注意力/资金达峰
 *   S8 DECAY      注意力/资金/叙事衰退
 *
 * 纪律：
 *   1. S0–S3 是纯社交维度，依赖社交源（当前在 source-registry 为 BLOCKED）。
 *      因此 NEVER 自动进入；要进入必须由已授权社交源显式提供。
 *   2. S4–S8 由 on-chain 证据单调推进，NEVER 回退。
 *   3. 无证据 → undefined（UNKNOWN），不臆测阶段。
 *   4. STAR 的实际介入窗口 = S2/S3 → S4（即“共识正在资产化的最早一刻”）。
 */
export type OnChainEvidence = {
  /** 已观测到资产化 token（≥1 表示存在 launch/token）。 */
  assetized?: boolean;
  /** 对池流动性（quote reserve，USDC 等价）。>0 表示流动性建立。 */
  liquidityUsdc?: number | null;
  /** 聪明钱/资金流入。true 表示 smart-money 进入。 */
  smartMoneyIn?: boolean | null;
  /** 注意力/流动性已达峰（此后进入衰落）。 */
  peakReached?: boolean;
  /** 流动性撤出 / 无新钱进入（进入 DECAY）。 */
  decayed?: boolean;
};

/**
 * 计算 on-chain 证据对应的最低阶段。返回 undefined 表示证据不足以锚定任何 S4–S8 阶段。
 * 注意：S0–S3 只可能由已授权社交源驱动，本函数永远不对它们输出。
 */
function onChainTarget(ev: OnChainEvidence): NarrativeStage | undefined {
  if (ev.decayed) return 'S8-DECAY';
  if (ev.peakReached) return 'S7-CONSENSUS-PEAK';
  if (ev.smartMoneyIn) return 'S6-SPECULATION';
  if (ev.liquidityUsdc && ev.liquidityUsdc > 0) return 'S5-LIQUIDITY';
  if (ev.assetized) return 'S4-ASSETIZATION';
  return undefined;
}

const ORDER: Record<NarrativeStage, number> = {
  'S0-EVENT': 0,
  'S1-SEED': 1,
  'S2-SPREAD': 2,
  'S3-CONSENSUS': 3,
  'S4-ASSETIZATION': 4,
  'S5-LIQUIDITY': 5,
  'S6-SPECULATION': 6,
  'S7-CONSENSUS-PEAK': 7,
  'S8-DECAY': 8,
};

/**
 * 单调推进一个叙事的生命周期阶段（on-chain 驱动）：
 * - 传入新证据，若证据能锚定更高阶段则推进，否则保持当前（绝不下行）。
 * - 当前为 `undefined` 且证据不足以锚定任何阶段 → 保持 `undefined`（UNKNOWN）。
 * - 当前为 `undefined` 且有 on-chain 证据 → 初始化为该证据对应阶段（最低 S4）。
 *
 * S0–S3（社交维度）本函数永不输出；它们只能在获得已授权社交源后由上游显式注入
 * （参见 `Narrative.stage` 注释，当前 source-registry 推特/X 为 BLOCKED）。
 */
export function advanceNarrativeStage(
  current: NarrativeStage | undefined,
  onChain?: OnChainEvidence,
): NarrativeStage | undefined {
  const target = onChainTarget(onChain ?? {});
  if (!target) return current;
  if (!current) return target;
  return ORDER[current] >= ORDER[target] ? current : target;
}

/** 验证早期事实组合已经到哪个阶段（U-01 实际可观测路径：launch → liquidity → smart money）。 */
export function stageFromEarlySignal(
  launch?: LaunchEvent,
  book?: BookFact,
  money?: MoneyFact,
): NarrativeStage | undefined {
  const ev: OnChainEvidence = {
    assetized: !!launch,
    liquidityUsdc: book?.quoteReserve ?? 0,
    smartMoneyIn: money?.flowIn ?? null,
  };
  return onChainTarget(ev);
}

export { NARRATIVE_STAGES };
export type { NarrativeStage };