/**
 * B1 ingest orchestration: runs the full recording chain over a universe.
 * Records ONLY. No signal, no score, no gate, no decision, no exit — the
 * write surface is the five b1_* tables and nothing else (B1-8 acceptance
 * is enforced by tests, including DB-level append-only triggers).
 */
import type { StarDb } from '@/lib/db';
import { recordAnchor, recordEvent, recordEventNarrativeLink, recordNarrative, recordNarrativeAsset } from './record';
import {
  B1_FIXTURE_ANCHORS,
  B1_FIXTURE_ASSETS,
  B1_FIXTURE_EVENTS,
  B1_FIXTURE_LINKS,
  B1_FIXTURE_NARRATIVES,
} from './fixture';
import { B1_RECORDER_VERSION } from './contract';

export { B1_RECORDER_VERSION };

export interface B1IngestSummary {
  version: typeof B1_RECORDER_VERSION;
  events: { recorded: number; created: number };
  narratives: { recorded: number; created: number };
  links: { recorded: number; created: number };
  assets: { recorded: number; created: number };
  anchors: { recorded: number; created: number };
}

/** Idempotent: re-running over the same universe creates nothing. */
export async function runB1FixtureIngest(db: StarDb): Promise<B1IngestSummary> {
  const events = { recorded: 0, created: 0 };
  for (const input of B1_FIXTURE_EVENTS) {
    const r = await recordEvent(db, input);
    events.recorded += 1;
    if (r.created) events.created += 1;
  }

  const narratives = { recorded: 0, created: 0 };
  for (const input of B1_FIXTURE_NARRATIVES) {
    const r = await recordNarrative(db, input);
    narratives.recorded += 1;
    if (r.created) narratives.created += 1;
  }

  const links = { recorded: 0, created: 0 };
  for (const input of B1_FIXTURE_LINKS) {
    const r = await recordEventNarrativeLink(db, input);
    links.recorded += 1;
    if (r.created) links.created += 1;
  }

  const assets = { recorded: 0, created: 0 };
  for (const input of B1_FIXTURE_ASSETS) {
    const r = await recordNarrativeAsset(db, input);
    assets.recorded += 1;
    if (r.created) assets.created += 1;
  }

  const anchors = { recorded: 0, created: 0 };
  for (const input of B1_FIXTURE_ANCHORS) {
    const r = await recordAnchor(db, input);
    anchors.recorded += 1;
    if (r.created) anchors.created += 1;
  }

  return { version: B1_RECORDER_VERSION, events, narratives, links, assets, anchors };
}
