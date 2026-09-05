import type { BookFact, LaunchEvent, MarketAdapterInfo, MarketPolicy } from '@/lib/alpha/core/types';

/** One adapter per market instance. Core never imports native venue names. */
export interface MarketAdapter {
  info: MarketAdapterInfo;
  policy: MarketPolicy;
  toLaunchEvent(raw: unknown): LaunchEvent;
  toBookFact(raw: unknown): BookFact;
}
