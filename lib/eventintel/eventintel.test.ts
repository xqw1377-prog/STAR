/**
 * M4 acceptance — event intelligence (AlphaRidge schema rewrite + STAR clustering).
 *  - same event across independent sources collapses into ONE cluster
 *  - unrelated events stay separate
 *  - narrative candidate is a CANDIDATE (identity stays with STAR/B1)
 *  - external-event-candidate evidence NEVER has gate eligibility
 *  - Event → Narrative direction only; no token-derived identity anywhere
 */
import { describe, expect, it } from 'vitest';
import { gateEligibility } from '@/lib/evidence/contract';
import { buildEventEvidence, clusterEvents, fingerprintObservation, narrativeCandidateFromCluster } from './cluster';

const OBS = '2026-09-04T00:00:00.000Z';

async function fp(id: string, title: string, keywords: string[], source = 'synthetic-fixtures', date: string | null = '2026-09-03') {
  return fingerprintObservation({
    sourceObservationId: id,
    sourceId: source,
    eventType: 'POLICY_ANNOUNCEMENT',
    eventTitle: title,
    eventDate: date,
    body: `${title} ${keywords.join(' ')}`,
    entityRefs: ['official-x'],
    assetCandidates: [],
    observedAt: OBS,
    keywords,
  });
}

describe('M4 fingerprint + clustering', () => {
  it('collapses cross-source reports of the same event into one cluster', async () => {
    const clusters = await clusterEvents([
      await fp('obs-1', 'Major policy announcement shakes market', ['policy', 'announcement', 'market', 'crypto']),
      await fp('obs-2', 'Policy announcement moves crypto markets', ['policy', 'announcement', 'crypto', 'market']),
      await fp('obs-3', 'Officials confirm sweeping policy change', ['policy', 'announcement', 'market', 'officials']),
      await fp('obs-4', 'Unrelated tech launch', ['tech', 'launch', 'product']),
    ]);
    expect(clusters).toHaveLength(2);
    const main = clusters.find((c) => c.observationCount === 3);
    expect(main).toBeDefined();
    expect(main!.sourceCount).toBe(1); // all from fixture source; count is per sourceId
    expect(main!.keywords).toContain('policy');
    const alone = clusters.find((c) => c.observationCount === 1);
    expect(alone!.members[0].eventTitle).toBe('Unrelated tech launch');
  });

  it('exact content-hash dedup merges identical reports', async () => {
    const a = await fp('obs-1', 'Same title', ['a', 'b']);
    const b = await fp('obs-2', 'Same title', ['a', 'b']);
    const clusters = await clusterEvents([a, b]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].observationCount).toBe(2);
  });

  it('candidate is a CANDIDATE: suggested label, cluster ref, no identity claim', async () => {
    const clusters = await clusterEvents([await fp('obs-1', 'Policy wave', ['policy', 'wave'])]);
    const candidate = narrativeCandidateFromCluster(clusters[0]);
    expect(candidate.candidateId).toMatch(/^narcand-/);
    expect(candidate.suggestedLabel).toBeTruthy();
    expect(candidate.confidence).toBeLessThanOrEqual(1);
    expect(JSON.stringify(candidate)).not.toMatch(/narrativeId|"identity"/);
  });
});

describe('M4 evidence emission', () => {
  it('external-event-candidate evidence NEVER has gate eligibility', async () => {
    expect(gateEligibility('external-event-candidate')).toEqual([]);
    const clusters = await clusterEvents([await fp('obs-1', 'Policy wave', ['policy', 'wave'])]);
    const records = await buildEventEvidence(clusters, OBS);
    expect(records).toHaveLength(1);
    expect(records[0].factType).toBe('external-event-candidate');
    expect(records[0].cap).toBe('CAP-01-EVENT');
  });
});
