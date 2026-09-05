import type { LaunchEvent } from '@/lib/alpha/core/types';
import type { Narrative, WorldEvent } from '@/lib/alpha/core/signal';

/** Binds attention to assets. Never decides ENTER. */
export interface NarrativeAdapter {
  id: string;
  watch(): WorldEvent[];
  bind(event: WorldEvent, launches: LaunchEvent[]): Narrative[];
}
