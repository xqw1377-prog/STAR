import type { LaunchEvent } from '@/lib/alpha/core/types';
import type { Narrative, WorldEvent } from '@/lib/alpha/core/signal';
import type { NarrativeAdapter } from './contract';

const EVENT: WorldEvent = {
  id: 'evt-fixture-attention',
  label: 'attention-spike',
  observedAt: '2026-09-04T00:00:00.000Z',
  attention: 0.9,
};

/** Solana verification fixture. Not a prediction of the next hotspot. */
export const fixtureNarrativeAdapter: NarrativeAdapter = {
  id: 'narrative-fixture',
  watch: () => [EVENT],
  bind(event: WorldEvent, launches: LaunchEvent[]): Narrative[] {
    if (event.id !== EVENT.id) return [];
    return launches.map((launch) => ({
      id: `nar-${launch.assetId.slice(0, 8)}`,
      eventId: event.id,
      label: 'new-asset-after-attention',
      observedAt: launch.observedAt,
    }));
  },
};
