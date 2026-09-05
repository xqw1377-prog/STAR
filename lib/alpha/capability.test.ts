import { describe, expect, it } from 'vitest';
import { CAPABILITY, capabilityPublic } from './capability';
import { SNIPE_STRATEGY_ID, SNIPE_V0 } from './strategy/snipe-v0';
import { resolveExecutionMode } from './execution/mode';

describe('capability alignment', () => {
  it('locks purpose, strategy, and live execution to the same objects', () => {
    expect(CAPABILITY.id).toBe('star-capability@3');
    expect(CAPABILITY.purpose).toBe('MEME-SNIPE-AUTO');
    expect(CAPABILITY.money).toBe('NO-EVIDENCE');
    expect(CAPABILITY.research).toBe('SHELL-ONLY');
    expect(CAPABILITY.runtime.strategy).toBe(SNIPE_STRATEGY_ID);
    expect(CAPABILITY.runtime.strategy).toBe(SNIPE_V0.id);
    expect(CAPABILITY.runtime.autoTrade).toBe(true);
    expect(CAPABILITY.runtime.snipeCycleWired).toBe(true);
    expect(CAPABILITY.runtime.snipeLoop).toBe('process-interval');
    expect(CAPABILITY.runtime.deskRequiresResearchDb).toBe(false);
    expect(CAPABILITY.runtime.broadcast).toBe(false);
    expect(CAPABILITY.runtime.walletModule).toBe(false);
    expect(capabilityPublic().runtime.executionMode).toBe(resolveExecutionMode());
    expect(capabilityPublic().runtime.executionDefault).toBe('DRY_RUN');
  });
});
