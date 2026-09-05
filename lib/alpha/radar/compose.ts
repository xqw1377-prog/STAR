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
      const launch = input.launches.find((l) => `nar-${l.assetId.slice(0, 8)}` === narrative.id);
      if (!launch) continue;
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
  return out;
}
