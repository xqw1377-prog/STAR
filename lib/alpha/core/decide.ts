import { maxNameNotionalUsdc, PORTFOLIO_POLICY_V0 } from '@/lib/alpha/account/policy';
import type { BookFact, LaunchEvent, MarketPolicy } from './types';
import type { EarlySignal } from './signal';
import type { OpenPosition } from '@/lib/alpha/strategy/snipe-v0';

export type CoreSkip =
  | 'VENUE_NOT_IN_UNIVERSE'
  | 'QUOTE_NOT_ALLOWED'
  | 'RESERVE_BELOW_MIN'
  | 'ALREADY_IN_POSITION'
  | 'MAX_POSITIONS'
  | 'NO_BOOK'
  | 'NO_CLOCK';

export function decideLaunch(
  event: LaunchEvent,
  book: BookFact | undefined,
  open: OpenPosition[],
  policy: MarketPolicy,
): { enter: true; notionalUsdc: number } | { enter: false; reason: CoreSkip } {
  if (event.clock == null) return { enter: false, reason: 'NO_CLOCK' };
  if (!policy.venues.includes(event.venue)) return { enter: false, reason: 'VENUE_NOT_IN_UNIVERSE' };
  if (!policy.quotes.includes(event.quote)) return { enter: false, reason: 'QUOTE_NOT_ALLOWED' };
  if (event.initialReserve < policy.minReserve) return { enter: false, reason: 'RESERVE_BELOW_MIN' };
  if (!book) return { enter: false, reason: 'NO_BOOK' };
  if (open.some((p) => p.mint === event.assetId)) return { enter: false, reason: 'ALREADY_IN_POSITION' };
  if (open.length >= PORTFOLIO_POLICY_V0.maxPositions) return { enter: false, reason: 'MAX_POSITIONS' };
  return { enter: true, notionalUsdc: maxNameNotionalUsdc(PORTFOLIO_POLICY_V0.initialNavUsdc) };
}

export type SignalSkip = CoreSkip | 'NO_NARRATIVE' | 'MONEY_OUTFLOW';

/** Event → Narrative → Asset → Market → Money. Money dark is allowed; money leaving is not. */
export function decideSignal(
  signal: EarlySignal,
  open: OpenPosition[],
  policy: MarketPolicy,
): { enter: true; notionalUsdc: number } | { enter: false; reason: SignalSkip } {
  if (signal.narrative.eventId !== signal.event.id) return { enter: false, reason: 'NO_NARRATIVE' };
  if (signal.assetId !== signal.launch.assetId) return { enter: false, reason: 'NO_NARRATIVE' };
  if (signal.money.flowIn === false) return { enter: false, reason: 'MONEY_OUTFLOW' };
  return decideLaunch(signal.launch, signal.book, open, policy);
}
