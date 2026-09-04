import { describe, expect, it } from 'vitest';
import { CAPABILITY } from '../capability';
import { assignMintBucket, EXPERIMENT_SPLIT } from './experiment';
import { IntentRejected, lockDecisionIntent } from './intent';
import { maxNameNotionalUsdc, PORTFOLIO_POLICY_V0 } from './policy';

describe('capability ledger', () => {
  it('does not claim money ability or a wired wallet', () => {
    expect(CAPABILITY.money).toBe('NO-EVIDENCE');
    expect(CAPABILITY.runtime.walletModule).toBe(false);
    expect(CAPABILITY.runtime.broadcast).toBe(false);
    expect(CAPABILITY.runtime.recorderWiredToApi).toBe(false);
    expect(CAPABILITY.runtime.storesCoupled).toBe(false);
    expect(CAPABILITY.runtime.refreshCollectsChain).toBe(false);
  });
});

describe('portfolio policy v0', () => {
  it('matches frozen B1.1 numbers', () => {
    expect(PORTFOLIO_POLICY_V0.initialNavUsdc).toBe(100_000);
    expect(PORTFOLIO_POLICY_V0.leverage).toBe(0);
    expect(maxNameNotionalUsdc(100_000)).toBe(500);
    expect(PORTFOLIO_POLICY_V0.maxPositions).toBe(5);
  });
});

describe('lockDecisionIntent', () => {
  it('sets executable_slot = max(signal, decision) + 2', () => {
    const locked = lockDecisionIntent({
      mint: 'Mint1111111111111111111111111111111111111',
      side: 'BUY',
      maxNotionalUsdc: 500,
      signalSlot: 10,
      decisionSlot: 12,
      hasPointInTimeBook: true,
    });
    expect(locked.executableSlot).toBe(14);
    expect(locked.locked).toBe(true);
  });

  it('rejects missing book as NO_POINT_IN_TIME_BOOK', () => {
    expect(() => lockDecisionIntent({
      mint: 'Mint1111111111111111111111111111111111111',
      side: 'BUY',
      maxNotionalUsdc: 100,
      signalSlot: 1,
      decisionSlot: 1,
      hasPointInTimeBook: false,
    })).toThrow(IntentRejected);
    try {
      lockDecisionIntent({
        mint: 'Mint1111111111111111111111111111111111111',
        side: 'BUY',
        maxNotionalUsdc: 100,
        signalSlot: 1,
        decisionSlot: 1,
        hasPointInTimeBook: false,
      });
    } catch (e) {
      expect(e).toBeInstanceOf(IntentRejected);
      expect((e as IntentRejected).label).toBe('NO_POINT_IN_TIME_BOOK');
    }
  });
});

describe('experiment split', () => {
  it('keeps 60/20/20 proportions on a 10-mint universe', () => {
    const buckets = Array.from({ length: 10 }, (_, i) => assignMintBucket(i, 10));
    expect(buckets.filter((b) => b === 'TRAIN').length).toBe(6);
    expect(buckets.filter((b) => b === 'VALIDATION').length).toBe(2);
    expect(buckets.filter((b) => b === 'SEALED').length).toBe(2);
    expect(EXPERIMENT_SPLIT.embargoDays).toBe(14);
  });
});
