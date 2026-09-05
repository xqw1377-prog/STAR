/**
 * B1 fixture universe — the recording target until a licensed real source is
 * ENABLED in the registry (RPC provider selection pending; the recorder is
 * provider-agnostic by design). Synthetic history, NOT a performance claim.
 *
 * Direction discipline (model §2): events and narratives are defined
 * independently of launches; assets are attributed INTO narratives. The
 * attribution here is 'labeled' — an honest basis for fixtures (the fixture
 * mints carry no real names to match).
 */
import { FIXTURE_BOOKS, FIXTURE_NEW_POOLS } from '@/lib/alpha/recorder/fixture-universe';
import { solanaLaunchAdapter } from '@/lib/alpha/markets/solana/adapter';
import type { LaunchEvent } from '@/lib/alpha/core/types';
import type {
  B1AnchorBasis,
  B1AnchorKind,
  B1AttributionBasis,
  B1EventRelation,
} from './contract';
import type {
  RecordAnchorInput,
  RecordAssetInput,
  RecordEventInput,
  RecordLinkInput,
  RecordNarrativeInput,
} from './record';

export const B1_SOURCE_ID = 'synthetic-fixtures';

const launches: LaunchEvent[] = FIXTURE_NEW_POOLS.map((raw) => solanaLaunchAdapter.toLaunchEvent(raw));

function launchOf(assetId: string): LaunchEvent {
  const launch = launches.find((l) => l.assetId === assetId);
  if (!launch) throw new Error(`B1 fixture: no launch for ${assetId}`);
  return launch;
}

/** Earliest observed birth/pool time among a narrative's assets (cluster clock). */
function earliestObservedAt(assetIds: string[], pick: (assetId: string) => string): string {
  return assetIds.map(pick).sort()[0];
}

const AI_ASSETS = ['PumpMint111111111111111111111111111111111', 'AmmMint1111111111111111111111111111111111'];
const PAY_ASSETS = ['CpmmMint111111111111111111111111111111111'];

export const B1_FIXTURE_EVENTS: RecordEventInput[] = [
  {
    eventKey: 'evt-fixture-ai-agents',
    label: 'ai-agents-attention-spike',
    attention: 0.9,
    observedAt: '2026-09-03T23:58:00.000Z',
    sourceId: B1_SOURCE_ID,
    payload: { note: 'fixture world event; World Radar has no sensor until B3', attention: 0.9 },
  },
  {
    eventKey: 'evt-fixture-payments',
    label: 'payments-attention-spike',
    attention: 0.6,
    observedAt: '2026-09-03T23:59:00.000Z',
    sourceId: B1_SOURCE_ID,
    payload: { note: 'fixture world event; World Radar has no sensor until B3', attention: 0.6 },
  },
];

export const B1_FIXTURE_NARRATIVES: RecordNarrativeInput[] = [
  {
    narrativeKey: 'nar-fixture-ai-agents',
    label: 'ai-agents',
    aliases: ['ai-agents', 'agent-meme'],
    observedAt: '2026-09-03T23:58:30.000Z',
    sourceId: B1_SOURCE_ID,
    payload: { note: 'fixture narrative; exists independently of its assets (model §2)' },
  },
  {
    narrativeKey: 'nar-fixture-payments',
    label: 'payments-on-solana',
    aliases: ['payments', 'usdc-payments'],
    observedAt: '2026-09-03T23:59:30.000Z',
    sourceId: B1_SOURCE_ID,
    payload: { note: 'fixture narrative; exists independently of its assets (model §2)' },
  },
];

export const B1_FIXTURE_LINKS: Array<RecordLinkInput & { relation: B1EventRelation }> = [
  {
    eventKey: 'evt-fixture-ai-agents',
    narrativeKey: 'nar-fixture-ai-agents',
    relation: 'produces',
    observedAt: '2026-09-03T23:58:30.000Z',
    sourceId: B1_SOURCE_ID,
    payload: { note: 'fixture edge; one-way Event → Narrative' },
  },
  {
    eventKey: 'evt-fixture-payments',
    narrativeKey: 'nar-fixture-payments',
    relation: 'produces',
    observedAt: '2026-09-03T23:59:30.000Z',
    sourceId: B1_SOURCE_ID,
    payload: { note: 'fixture edge; one-way Event → Narrative' },
  },
];

function assetRecord(narrativeKey: string, assetId: string): RecordAssetInput & { attributionBasis: B1AttributionBasis } {
  const launch = launchOf(assetId);
  return {
    narrativeKey,
    assetId,
    universe: launch.universe,
    venue: launch.venue,
    attributionBasis: 'labeled',
    observedAt: launch.observedAt,
    sourceId: B1_SOURCE_ID,
    payload: { launch, note: 'fixture attribution into narrative (Narrative→Asset direction)' },
  };
}

export const B1_FIXTURE_ASSETS: Array<RecordAssetInput & { attributionBasis: B1AttributionBasis }> = [
  ...AI_ASSETS.map((assetId) => assetRecord('nar-fixture-ai-agents', assetId)),
  ...PAY_ASSETS.map((assetId) => assetRecord('nar-fixture-payments', assetId)),
];

function anchorRecord(
  narrativeKey: string,
  anchor: B1AnchorKind,
  anchoredAt: string,
  basis: B1AnchorBasis,
  payload: Record<string, unknown>,
): RecordAnchorInput & { anchor: B1AnchorKind; basis: B1AnchorBasis } {
  return {
    narrativeKey,
    anchor,
    anchoredAt,
    basis,
    sourceId: B1_SOURCE_ID,
    observedAt: anchoredAt,
    payload,
  };
}

function clusterAnchors(narrativeKey: string, eventKey: string, assetIds: string[]) {
  const event = B1_FIXTURE_EVENTS.find((e) => e.eventKey === eventKey)!;
  const firstToken = earliestObservedAt(assetIds, (id) => launchOf(id).observedAt);
  const firstPool = earliestObservedAt(assetIds, (id) => {
    const book = FIXTURE_BOOKS.find((b) => b.mint === id);
    if (!book) throw new Error(`B1 fixture: no book for ${id}`);
    return book.observedAt;
  });
  const firstAsset = assetIds.map((id) => launchOf(id)).sort((a, b) => a.observedAt.localeCompare(b.observedAt))[0];
  return [
    anchorRecord(narrativeKey, 'T_event', event.observedAt, 'labeled', {
      eventKey,
      note: 'fixture world event time; social anchors stay labeled until B3',
    }),
    anchorRecord(narrativeKey, 'T_first_token', firstToken, 'observed', {
      assetId: firstAsset.assetId,
      note: 'earliest recorded birth in the narrative cluster (on-chain observable)',
    }),
    anchorRecord(narrativeKey, 'T_first_pool', firstPool, 'observed', {
      assetId: firstAsset.assetId,
      note: 'earliest pool book in the narrative cluster (on-chain observable)',
    }),
  ];
}

/** §14 anchors observable at V1: T_event (labeled fixture) + on-chain T_first_token / T_first_pool. */
export const B1_FIXTURE_ANCHORS: Array<RecordAnchorInput & { anchor: B1AnchorKind; basis: B1AnchorBasis }> = [
  ...clusterAnchors('nar-fixture-ai-agents', 'evt-fixture-ai-agents', AI_ASSETS),
  ...clusterAnchors('nar-fixture-payments', 'evt-fixture-payments', PAY_ASSETS),
];
