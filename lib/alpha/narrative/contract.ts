import type { LaunchEvent } from '@/lib/alpha/core/types';
import type { Narrative, WorldEvent } from '@/lib/alpha/core/signal';

/** Binds attention to assets. Never decides ENTER. */
export interface NarrativeAdapter {
  id: string;
  watch(): WorldEvent[];
  bind(event: WorldEvent, launches: LaunchEvent[]): Narrative[];
  /**
   * Direction-correct attribution (FROZEN-rev1 §2): which launches belong to
   * the narrative. Assets are attributed INTO narratives — never derived
   * FROM asset ids (no Token→Narrative reverse attribution).
   */
  attribute(narrative: Narrative, launches: LaunchEvent[]): LaunchEvent[];
}
