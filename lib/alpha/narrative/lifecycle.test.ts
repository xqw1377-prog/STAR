import { describe, expect, it } from 'vitest';
import { advanceNarrativeStage, stageFromEarlySignal } from './lifecycle';
import type { LaunchEvent, BookFact } from '@/lib/alpha/core/types';
import type { MoneyFact } from '@/lib/alpha/core/signal';

describe('advanceNarrativeStage', () => {
  it('无证据 → undefined（UNKNOWN，不臆测）', () => {
    expect(advanceNarrativeStage(undefined, {})).toBeUndefined();
    expect(advanceNarrativeStage(undefined, undefined)).toBeUndefined();
  });

  it('首现 token（S4）', () => {
    expect(advanceNarrativeStage(undefined, { assetized: true })).toBe('S4-ASSETIZATION');
  });

  it('流动性建立（S5）', () => {
    expect(advanceNarrativeStage(undefined, { liquidityUsdc: 500 })).toBe('S5-LIQUIDITY');
  });

  it('聪明钱进入（S6）', () => {
    expect(advanceNarrativeStage(undefined, { smartMoneyIn: true })).toBe('S6-SPECULATION');
  });

  it('达峰（S7）/ 衰减（S8）', () => {
    expect(advanceNarrativeStage(undefined, { peakReached: true })).toBe('S7-CONSENSUS-PEAK');
    expect(advanceNarrativeStage(undefined, { decayed: true })).toBe('S8-DECAY');
  });

  it('单调推进：S4 → S5 → S6 → S7 → S8', () => {
    const s4 = advanceNarrativeStage(undefined, { assetized: true });
    expect(s4).toBe('S4-ASSETIZATION');
    const s5 = advanceNarrativeStage(s4, { liquidityUsdc: 100 });
    expect(s5).toBe('S5-LIQUIDITY');
    const s6 = advanceNarrativeStage(s5, { smartMoneyIn: true });
    expect(s6).toBe('S6-SPECULATION');
    const s7 = advanceNarrativeStage(s6, { peakReached: true });
    expect(s7).toBe('S7-CONSENSUS-PEAK');
    const s8 = advanceNarrativeStage(s7, { decayed: true });
    expect(s8).toBe('S8-DECAY');
  });

  it('绝不回退：已达 S7 后更弱证据保持 S7', () => {
    expect(advanceNarrativeStage('S7-CONSENSUS-PEAK', { assetized: true })).toBe(
      'S7-CONSENSUS-PEAK',
    );
  });

  it('绝不回退：已达 S8 后流动性仍存在保持 S8', () => {
    expect(advanceNarrativeStage('S8-DECAY', { liquidityUsdc: 999 })).toBe('S8-DECAY');
  });

  it('行为失败封闭：social 输入不产生任何阶段（S0–S3 不可 on-chain 推断）', () => {
    // attention/velocity 之类社交信号当前无源，不会自动进入 S0–S3
    expect(advanceNarrativeStage(undefined, {})).toBeUndefined();
  });
});

describe('stageFromEarlySignal', () => {
  const launch: LaunchEvent = {
    universe: 'U-01-SOLANA',
    assetId: 'x',
    venue: 'raydium-v4',
    quote: 'USDC',
    initialReserve: 500,
    reserveUnit: 'USDC',
    observedAt: '2026-09-04T00:00:00.000Z',
    clock: 1,
  };

  it('仅有 launch → S4', () => {
    expect(stageFromEarlySignal(launch, undefined, undefined)).toBe('S4-ASSETIZATION');
  });

  it('launch + book → S5', () => {
    const book: BookFact = { assetId: 'x', quoteReserve: 300, clock: 2 };
    expect(stageFromEarlySignal(launch, book, undefined)).toBe('S5-LIQUIDITY');
  });

  it('launch + book + money 流入 → S6', () => {
    const book: BookFact = { assetId: 'x', quoteReserve: 300, clock: 2 };
    const money: MoneyFact = { assetId: 'x', earlyWallets: 8, buyPressure: 0.7, flowIn: true };
    expect(stageFromEarlySignal(launch, book, money)).toBe('S6-SPECULATION');
  });

  it('无任何输入 → undefined', () => {
    expect(stageFromEarlySignal()).toBeUndefined();
  });
});