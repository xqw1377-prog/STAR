import type { LaunchEvent } from '@/lib/alpha/core/types';
import type { Narrative, WorldEvent } from '@/lib/alpha/core/signal';
import type { NarrativeAdapter } from './contract';

const EVENT: WorldEvent = {
  id: 'evt-fixture-attention',
  label: 'attention-spike',
  observedAt: '2026-09-04T00:00:00.000Z',
  attention: 0.9,
};

/**
 * Defined independently of any launch (FROZEN-rev1 §2): a narrative is a
 * first-class object that may exist with zero assets. Its id is never
 * derived from an asset id.
 */
const NARRATIVE: Narrative = {
  id: 'nar-fixture-early-launches',
  eventId: EVENT.id,
  label: 'early-launch-attention',
  observedAt: EVENT.observedAt,
};

/** Solana verification fixture. Not a prediction of the next hotspot. */
export const fixtureNarrativeAdapter: NarrativeAdapter = {
  id: 'narrative-fixture',
  watch: () => [EVENT],
  bind(event: WorldEvent): Narrative[] {
    if (event.id !== EVENT.id) return [];
    return [NARRATIVE];
  },
  attribute(narrative: Narrative, launches: LaunchEvent[]): LaunchEvent[] {
    if (narrative.id !== NARRATIVE.id) return [];
    // Fixture labeling: every observed launch is attributed INTO the one
    // fixture narrative — cluster membership, Narrative→Asset direction.
    return launches;
  },
};
