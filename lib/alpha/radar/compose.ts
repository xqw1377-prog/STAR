import type { BookFact, LaunchEvent } from '@/lib/alpha/core/types';
import type { EarlySignal, MoneyFact } from '@/lib/alpha/core/signal';
import type { NarrativeAdapter } from '@/lib/alpha/narrative/contract';

export function composeEarlySignals(input: {
  adapter: NarrativeAdapter;
  launches: LaunchEvent[];
  books: BookFact[];
  money: MoneyFact[];
}): EarlySignal[] {
  const out: EarlySignal[] = [];
  for (const event of input.adapter.watch()) {
    const narratives = input.adapter.bind(event, input.launches);
    for (const narrative of narratives) {
      // Attribution is owned by the adapter (FROZEN-rev1 §2): assets are
      // attributed INTO narratives; narrative ids are never derived from
      // asset ids.
      for (const launch of input.adapter.attribute(narrative, input.launches)) {
        out.push({
          event,
          narrative,
          assetId: launch.assetId,
          market: launch.universe,
          launch,
          book: input.books.find((b) => b.assetId === launch.assetId),
          money: input.money.find((m) => m.assetId === launch.assetId) ?? {
            assetId: launch.assetId,
            earlyWallets: null,
            buyPressure: null,
            flowIn: null,
          },
        });
      }
    }
  }
  return out;
}
