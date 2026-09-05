import { describe, expect, it } from 'vitest';
import type { NewPoolBirth, PoolBookSnapshot } from '@/lib/alpha/recorder/types';
import { shouldEnter, SNIPE_V0 } from '@/lib/alpha/strategy/snipe-v0';
import { solanaLaunchAdapter } from '@/lib/alpha/markets/solana/adapter';
import { resolveExecutionMode } from './mode';
import { runSnipeCycle } from './cycle';
import { resetSnipeRuntime, tickSnipeRuntime } from './runtime';

const birth = (over: Partial<NewPoolBirth> = {}): NewPoolBirth => ({
  mint: 'Mint1111111111111111111111111111111111111',
  dex: 'pump.fun-bonding-curve',
  quoteAsset: 'SOL',
  poolAddress: 'Pool1111111111111111111111111111111111111',
  initialReserveSolEq: 10,
  observedAt: '2026-09-05T00:00:00.000Z',
  effectiveAt: '2026-09-05T00:00:00.000Z',
  slot: 100,
  source: 'fixture',
  receiptId: 'r1',
  ...over,
});

const book = (over: Partial<PoolBookSnapshot> = {}): PoolBookSnapshot => ({
  mint: 'Mint1111111111111111111111111111111111111',
  poolAddress: 'Pool1111111111111111111111111111111111111',
  quoteReserveSol: 12,
  baseReserveRaw: '1000000',
  slot: 100,
  observedAt: '2026-09-05T00:00:00.000Z',
  source: 'fixture',
  receiptId: 'r1',
  ...over,
});

describe('snipe-v0', () => {
  it('rejects reserve below 8 SOL', () => {
    const v = shouldEnter(birth({ initialReserveSolEq: 2 }), book(), [], solanaLaunchAdapter);
    expect(v.enter).toBe(false);
  });

  it('accepts a universe-qualified birth with a book', () => {
    const v = shouldEnter(birth(), book(), [], solanaLaunchAdapter);
    expect(v.enter).toBe(true);
    if (v.enter) expect(v.notionalUsdc).toBe(500);
  });
});

describe('runSnipeCycle', () => {
  it('opens then auto-exits when liquidity collapses', () => {
    const mint = 'Mint1111111111111111111111111111111111111';
    const opened = runSnipeCycle({
      births: [birth({ mint })],
      books: [book({ mint, slot: 100, quoteReserveSol: 12 })],
      open: [],
      decisionSlot: 102,
    });
    expect(opened.some((t) => t.side === 'BUY' && t.label === 'FILL_OK')).toBe(true);

    const closed = runSnipeCycle({
      births: [],
      books: [book({ mint, slot: 200, quoteReserveSol: 0.2 })],
      open: [{ mint, entrySlot: 104, notionalUsdc: 500 }],
      decisionSlot: 200,
    });
    const sell = closed.find((t) => t.side === 'SELL');
    expect(sell?.exitReason).toBe('LIQUIDITY_EXIT');
  });

  it('stays DRY_RUN without STAR_MICRO_LIVE', () => {
    expect(resolveExecutionMode({})).toBe('DRY_RUN');
    expect(resolveExecutionMode({ STAR_MICRO_LIVE: '1' })).toBe('DRY_RUN');
    expect(resolveExecutionMode({ STAR_MICRO_LIVE: '1', STAR_WALLET_KEYPAIR: 'x' })).toBe('BROADCAST');
  });

  it('does not broadcast even when armed — adapter not wired', () => {
    const trades = runSnipeCycle({
      births: [birth()],
      books: [book()],
      open: [],
      decisionSlot: 102,
      env: { STAR_MICRO_LIVE: '1', STAR_WALLET_KEYPAIR: 'x' },
    });
    expect(trades[0]?.fill?.mode).toBe('BROADCAST');
    expect(trades[0]?.label).toBe('EXECUTION_FAILURE');
  });
});

describe('snipe strategy id', () => {
  it('is versioned', () => {
    expect(SNIPE_V0.id).toBe('snipe-value-meme@v0');
  });
});

describe('snipe runtime', () => {
  it('auto-opens fixture births then exits on collapse', () => {
    resetSnipeRuntime();
    const first = tickSnipeRuntime();
    expect(first.open.length).toBe(3);
    expect(first.cashUsdc).toBe(98_500);
    expect(first.navUsdc).toBe(100_000);
    expect(first.trades.some((t) => t.side === 'BUY' && t.label === 'FILL_OK')).toBe(true);

    let last = first;
    for (let i = 0; i < 5; i += 1) last = tickSnipeRuntime();
    expect(last.trades.some((t) => t.side === 'SELL' && t.exitReason === 'LIQUIDITY_EXIT')).toBe(true);
    expect(last.open.length).toBeLessThan(3);
  });
});
