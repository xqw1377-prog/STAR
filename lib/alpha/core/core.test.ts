import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { decideLaunch, decideSignal } from './decide';
import { thesisBroken } from './thesis';
import { composeEarlySignals } from '@/lib/alpha/radar/compose';
import { fixtureNarrativeAdapter } from '@/lib/alpha/narrative/fixture';
import { CONVEX_POLICY } from '@/lib/alpha/account/convex';
import { UNIVERSE_CLASS, UNIVERSE_CLASS_NAME, type LaunchEvent, type MarketPolicy } from './types';
import { MARKET_RADAR, assertOnlySelectedInstance } from '@/lib/alpha/markets/registry';
import { solanaLaunchAdapter } from '@/lib/alpha/markets/solana/adapter';

describe('STAR Core is not a chain', () => {
  it('names U-01 as a market class, not Solana', () => {
    expect(UNIVERSE_CLASS).toBe('U-01');
    expect(UNIVERSE_CLASS_NAME).toBe('Early On-chain Launch Market');
    expect(MARKET_RADAR.selected).toBe('U-01-SOLANA');
    expect(MARKET_RADAR.boards['U-01-BNB'].heat).toBe('NOT-INSTANCED');
  });

  it('core source does not mention native Solana venues', () => {
    const text = readFileSync(new URL('./types.ts', import.meta.url), 'utf8');
    expect(text).not.toMatch(/pump\.fun|Raydium|Jupiter/i);
  });

  it('accepts a non-Solana launch event when a foreign policy is supplied', () => {
    const policy: MarketPolicy = {
      instance: 'U-01-BNB',
      venues: ['four.meme'],
      quotes: ['BNB'],
      minReserve: 8,
      exitReserve: 1,
      maxHoldClocks: 1800,
      reserveUnit: 'BNB-eq',
    };
    const event: LaunchEvent = {
      universe: 'U-01-BNB',
      assetId: '0xdemo',
      venue: 'four.meme',
      quote: 'BNB',
      initialReserve: 12,
      reserveUnit: 'BNB-eq',
      observedAt: '2026-09-05T00:00:00.000Z',
      clock: 1,
    };
    const verdict = decideLaunch(event, { assetId: '0xdemo', quoteReserve: 12, clock: 1 }, [], policy);
    expect(verdict.enter).toBe(true);
  });

  it('runtime refuses a universe that is not selected', () => {
    expect(() => assertOnlySelectedInstance('U-01-BNB')).toThrow(/not selected/);
  });

  it('hunts the narrative-to-asset link, not a hot token list', () => {
    const launch: LaunchEvent = {
      universe: 'U-01-SOLANA',
      assetId: 'Mint1111111111111111111111111111111111111',
      venue: 'pump.fun-bonding-curve',
      quote: 'SOL',
      initialReserve: 12,
      reserveUnit: 'SOL-eq',
      observedAt: '2026-09-04T00:00:00.000Z',
      clock: 1001,
    };
    const signals = composeEarlySignals({
      adapter: fixtureNarrativeAdapter,
      launches: [launch],
      books: [{ assetId: launch.assetId, quoteReserve: 12, clock: 1001 }],
      money: [{ assetId: launch.assetId, earlyWallets: null, buyPressure: null, flowIn: null }],
    });
    expect(signals).toHaveLength(1);
    expect(signals[0].event.id).toBe('evt-fixture-attention');
    const enter = decideSignal(signals[0], [], solanaLaunchAdapter.policy);
    expect(enter.enter).toBe(true);
    const outflow = decideSignal(
      { ...signals[0], money: { ...signals[0].money, flowIn: false } },
      [],
      solanaLaunchAdapter.policy,
    );
    expect(outflow.enter).toBe(false);
  });

  it('breaks the thesis when the narrative dies', () => {
    const why = thesisBroken({
      narrativeAlive: false,
      moneyStillIn: true,
      earlyWalletsActive: true,
      liquidityOk: true,
      holderWorse: null,
      devAnomaly: null,
      structureChanged: null,
    });
    expect(why).toContain('narrative gone');
  });

  it('uses a convex book, not a high-win-rate book', () => {
    expect(CONVEX_POLICY.requireHighWinRate).toBe(false);
    expect(CONVEX_POLICY.acceptHighMissRate).toBe(true);
    expect(CONVEX_POLICY.maxNameWeight).toBe(0.005);
  });

  it('Solana adapter holds native names; core policy is read from it', () => {
    expect(solanaLaunchAdapter.info.executionProvider).toBe('jupiter-ultra');
    expect(solanaLaunchAdapter.policy.venues).toContain('pump.fun-bonding-curve');
    expect(solanaLaunchAdapter.info.selected).toBe(true);
  });
});
