import { describe, expect, it } from 'vitest';
import { SOURCE_REGISTRY } from '@/lib/data/source-registry';
import { STAR_ROLES } from './layers';
import { discoverCandidates } from './discovery/ave';
import { decideEnter } from './decision/engine';
import { decideExit } from './exit/engine';
import { jupiterExecute, jupiterExecuteAllowed, jupiterOrder } from './execution/jupiter-ultra';
import type { NewPoolBirth, PoolBookSnapshot } from './recorder/types';

const birth: NewPoolBirth = {
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
};

const book: PoolBookSnapshot = {
  mint: birth.mint,
  poolAddress: birth.poolAddress,
  quoteReserveSol: 12,
  baseReserveRaw: '1',
  slot: 100,
  observedAt: birth.observedAt,
  source: 'fixture',
  receiptId: 'r1',
};

describe('role separation', () => {
  it('Ave and Jupiter cannot decide entry', () => {
    expect(STAR_ROLES.discovery.decidesEntry).toBe(false);
    expect(STAR_ROLES.execution.decidesEntry).toBe(false);
    expect(STAR_ROLES.decision.decidesEntry).toBe(true);
    expect(STAR_ROLES.exit.decidesExit).toBe(true);
  });

  it('Ave live source stays off; fixture candidates are not decisions', () => {
    expect(SOURCE_REGISTRY['ave-ai']?.status).not.toBe('ENABLED');
    const eyes = discoverCandidates();
    expect(eyes.every((c) => c.source === 'synthetic-fixtures')).toBe(true);
    const noBook = decideEnter(birth, undefined, [], eyes[0]);
    expect(noBook.decide).toBe('SKIP');
  });

  it('Decision engine opens a window only with a verified book', () => {
    const open = decideEnter(birth, book, []);
    expect(open.decide).toBe('ENTER');
    expect(open.thesis.window).toBe('OPEN');
    expect(open.thesis.exitPlan.liquidityFloorSol).toBe(1);
  });

  it('Exit engine does not invent TP without a mark', () => {
    const hold = decideExit(
      { mint: birth.mint, entrySlot: 100, notionalUsdc: 500, exitPlan: { liquidityFloorSol: 1, maxHoldSlots: 1800, takeProfitBps: 500, stopLossBps: 200, trailingBps: null } },
      book,
      120,
      false,
      { pnlBps: null },
    );
    expect(hold.kind).toBe('HOLD');
  });

  it('Jupiter /execute stays locked even if live flags are waved', () => {
    expect(SOURCE_REGISTRY['jupiter-ultra']?.status).not.toBe('ENABLED');
    expect(jupiterExecuteAllowed({ STAR_MICRO_LIVE: '1', STAR_JUPITER_EXECUTE: '1', STAR_WALLET_KEYPAIR: 'x' })).toBe(false);
    const order = jupiterOrder({
      mint: birth.mint,
      side: 'BUY',
      maxNotionalUsdc: 500,
      executableSlot: 12,
      locked: true,
      label: null,
    });
    expect(order.router).toBe('fixture-sim');
    expect(jupiterExecute(order).reason).toBe('EXECUTE_FEATURE_LOCKED');
  });
});
