import { FIXTURE_BOOKS, FIXTURE_NEW_POOLS } from '@/lib/alpha/recorder/fixture-universe';
import type { NewPoolBirth, PoolBookSnapshot } from '@/lib/alpha/recorder/types';
import { CAPABILITY } from '@/lib/alpha/capability';
import { PORTFOLIO_POLICY_V0 } from '@/lib/alpha/account/policy';
import { SNIPE_V0 } from '@/lib/alpha/strategy/snipe-v0';
import { resolveExecutionMode, type ExecutionMode } from './mode';
import { runSnipeCycle, type CycleTrade } from './cycle';
import type { OpenPosition } from '@/lib/alpha/strategy/snipe-v0';
import { discoverCandidates } from '@/lib/alpha/discovery/ave';
import { STAR_LOOP } from '@/lib/alpha/layers';
import { composeEarlySignals } from '@/lib/alpha/radar/compose';
import { fixtureNarrativeAdapter } from '@/lib/alpha/narrative/fixture';
import { solanaLaunchAdapter } from '@/lib/alpha/markets/solana/adapter';
import { decideSignal, type SignalSkip } from '@/lib/alpha/core/decide';
import { decideExit, type ExitThesis } from '@/lib/alpha/exit/engine';
import type { EarlySignal } from '@/lib/alpha/core/signal';

export interface SnipeRuntimeSnapshot {
  purpose: typeof CAPABILITY.purpose;
  product: typeof CAPABILITY.product;
  loop: typeof STAR_LOOP;
  strategy: typeof SNIPE_V0.id;
  capability: typeof CAPABILITY.id;
  money: typeof CAPABILITY.money;
  roles: typeof CAPABILITY.roles;
  mode: ExecutionMode;
  broadcast: boolean;
  tick: number;
  decisionSlot: number;
  cashUsdc: number;
  navUsdc: number;
  open: OpenPosition[];
  trades: CycleTrade[];
  signals: EarlySignal[];
  /** Decision-explanation layer: each candidate with its live verdict (why in / why out). */
  pool: Array<{ signal: EarlySignal; verdict: { enter: boolean; reason?: SignalSkip; notionalUsdc?: number } }>;
  /** Exit layer: live exit thesis per held position (HOLD/EXIT + why) + current reserve for display. */
  exitTheses: Array<{ mint: string; reserveSol: number | null; exit: ExitThesis }>;
  lastTickAt: string | null;
}

const COLLAPSE_AFTER_TICKS = 4;

let tick = 0;
let decisionSlot = 1200;
let open: OpenPosition[] = [];
let books: PoolBookSnapshot[] = FIXTURE_BOOKS.map((b) => ({ ...b }));
let processed = new Set<string>();
let trades: CycleTrade[] = [];
let lastTickAt: string | null = null;
let cashUsdc = PORTFOLIO_POLICY_V0.initialNavUsdc;

function birthsPending(): NewPoolBirth[] {
  return FIXTURE_NEW_POOLS.filter((b) => !processed.has(b.mint)).map((b) => ({
    ...b,
    receiptId: `fixture-birth-${b.mint.slice(0, 8)}`,
  }));
}

function navUsdc(): number {
  return cashUsdc + open.reduce((sum, p) => sum + p.notionalUsdc, 0);
}

export function resetSnipeRuntime(): void {
  tick = 0;
  decisionSlot = 1200;
  open = [];
  books = FIXTURE_BOOKS.map((b) => ({ ...b }));
  processed = new Set();
  trades = [];
  lastTickAt = null;
  cashUsdc = PORTFOLIO_POLICY_V0.initialNavUsdc;
}

export function snapshotSnipeRuntime(): SnipeRuntimeSnapshot {
  const signals = currentSignals();
  const pool = signals.map((signal) => {
    const verdict = decideSignal(signal, open, solanaLaunchAdapter.policy);
    return verdict.enter
      ? { signal, verdict: { enter: true, notionalUsdc: verdict.notionalUsdc } as const }
      : { signal, verdict: { enter: false, reason: verdict.reason } as const };
  });
  const exitTheses = open.map((p) => {
    const book = books.find((b) => b.mint === p.mint);
    return {
      mint: p.mint,
      reserveSol: book ? book.quoteReserveSol : null,
      exit: decideExit(p, book, decisionSlot, false),
    };
  });
  return {
    purpose: CAPABILITY.purpose,
    product: CAPABILITY.product,
    loop: STAR_LOOP,
    strategy: SNIPE_V0.id,
    capability: CAPABILITY.id,
    money: CAPABILITY.money,
    roles: CAPABILITY.roles,
    mode: resolveExecutionMode(),
    broadcast: CAPABILITY.runtime.broadcast,
    tick,
    decisionSlot,
    cashUsdc,
    navUsdc: navUsdc(),
    open: [...open],
    trades: [...trades],
    signals,
    pool,
    exitTheses,
    lastTickAt,
  };
}

function currentSignals(): EarlySignal[] {
  const pending = birthsPending();
  return composeEarlySignals({
    adapter: fixtureNarrativeAdapter,
    launches: pending.map((b) => solanaLaunchAdapter.toLaunchEvent(b)),
    books: books.map((b) => solanaLaunchAdapter.toBookFact(b)),
    money: pending.map((b) => ({
      assetId: b.mint,
      earlyWallets: null,
      buyPressure: null,
      flowIn: null,
    })),
  });
}

/** Automatic strategy tick. Birth once per mint. Collapse first book to force exit. */
export function tickSnipeRuntime(env?: NodeJS.Dict<string>): SnipeRuntimeSnapshot {
  tick += 1;
  decisionSlot += 30;

  if (tick >= COLLAPSE_AFTER_TICKS && open.length > 0) {
    const target = open[0].mint;
    books = books.map((b) =>
      b.mint === target
        ? { ...b, quoteReserveSol: 0.2, slot: decisionSlot }
        : { ...b, slot: decisionSlot },
    );
  } else {
    books = books.map((b) => ({ ...b, slot: Math.max(b.slot, decisionSlot) }));
  }

  const cycle = runSnipeCycle({
    births: birthsPending(),
    books,
    open,
    decisionSlot,
    candidates: discoverCandidates(),
    env,
  });

  for (const t of cycle) {
    if (t.side === 'BUY' && t.label === 'FILL_OK' && t.intent && t.fill) {
      processed.add(t.mint);
      cashUsdc -= t.fill.filledNotionalUsdc;
      if (!open.some((p) => p.mint === t.mint)) {
        open.push({
          mint: t.mint,
          entrySlot: t.intent.executableSlot,
          notionalUsdc: t.fill.filledNotionalUsdc,
          exitPlan: t.entryThesis?.exitPlan,
        });
      }
    }
    if (t.side === 'SELL' && t.label === 'FILL_OK' && t.fill) {
      cashUsdc += t.fill.filledNotionalUsdc;
      open = open.filter((p) => p.mint !== t.mint);
    }
    if (t.side === 'SELL' && t.label === 'EXIT_IMPOSSIBLE') {
      open = open.filter((p) => p.mint !== t.mint);
    }
  }

  trades = [...trades, ...cycle].slice(-80);
  lastTickAt = new Date().toISOString();
  return snapshotSnipeRuntime();
}
