/**
 * M4 Event Intelligence — AlphaRidge schema rewritten (MIT, zero code copied)
 * + STAR-built clustering. Direction is frozen (FROZEN-rev1 §2):
 * ExternalObservation → EventFingerprint → EventCluster → NarrativeCandidate.
 * Candidates top out at CANDIDATE — they never become Narrative identity,
 * never touch gates (external-event-candidate has empty gate eligibility),
 * and never flow toward Decision Core from here.
 */
import type { EvidenceRecord } from '@/lib/evidence/contract';
import { EVIDENCE_CONTRACT_VERSION, assertEvidence } from '@/lib/evidence/contract';
import { sha256hex } from '@/lib/data/hash';

export const EVENT_INTEL_VERSION = 'star-eventintel@1';
export const EVENT_INTEL_SOURCE = 'synthetic-fixtures';
export const EVENT_INTEL_ADAPTER = 'event-intel-fixture';

// ── Fingerprint (AlphaRidge model, STAR-hardened with provenance) ──

export interface StarEventFingerprint {
  /** Originating external observation — full provenance back to the source. */
  sourceObservationId: string;
  sourceId: string;
  eventType: string;
  eventTitle: string;
  eventDate: string | null;
  /** Deterministic exact-dedup hash of the normalized observation content. */
  contentHash: string;
  /** ≤10 salient terms — the semantic handle for cross-source clustering. */
  semanticFingerprint: string[];
  entityRefs: string[];
  assetCandidates: string[];
  observedAt: string;
}

export async function fingerprintObservation(obs: {
  sourceObservationId: string;
  sourceId: string;
  eventType: string;
  eventTitle: string;
  eventDate: string | null;
  body: string;
  entityRefs: string[];
  assetCandidates: string[];
  observedAt: string;
  keywords: string[];
}): Promise<StarEventFingerprint> {
  const fp: StarEventFingerprint = {
    sourceObservationId: obs.sourceObservationId,
    sourceId: obs.sourceId,
    eventType: obs.eventType,
    eventTitle: obs.eventTitle,
    eventDate: obs.eventDate,
    contentHash: await sha256hex(`${obs.eventType}|${obs.eventTitle}|${obs.body}`),
    semanticFingerprint: [...new Set(obs.keywords)].slice(0, 10).sort(),
    entityRefs: obs.entityRefs,
    assetCandidates: obs.assetCandidates,
    observedAt: obs.observedAt,
  };
  if (!fp.semanticFingerprint.length) throw new Error('event fingerprint requires at least one keyword');
  return fp;
}

// ── Clustering (STAR-built — the cross-article engine was never in the source repo) ──

export interface EventCluster {
  /** Deterministic: hash of sorted member content hashes. */
  clusterId: string;
  members: StarEventFingerprint[];
  observationCount: number;
  sourceCount: number;
  firstObservedAt: string;
  lastObservedAt: string;
  dominantEventType: string;
  keywords: string[];
}

function jaccard(a: string[], b: string[]): number {
  const sa = new Set(a);
  const sb = new Set(b);
  const inter = [...sa].filter((x) => sb.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : inter / union;
}

function sameDayWindow(a: string | null, b: string | null, maxDays: number): boolean {
  if (!a || !b) return true; // missing dates may not split a strong content match
  return Math.abs(Date.parse(a) - Date.parse(b)) <= maxDays * 86_400_000;
}

function similar(a: StarEventFingerprint, b: StarEventFingerprint, threshold: number): boolean {
  if (a.contentHash === b.contentHash) return true;
  if (a.eventType !== b.eventType) return false;
  if (!sameDayWindow(a.eventDate, b.eventDate, 2)) return false;
  return jaccard(a.semanticFingerprint, b.semanticFingerprint) >= threshold;
}

/** Union-find over pairwise similarity: same event across independent sources collapses to one cluster. */
export async function clusterEvents(fingerprints: StarEventFingerprint[], similarityThreshold = 0.5): Promise<EventCluster[]> {
  const parent = fingerprints.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (i: number, j: number) => { parent[find(i)] = find(j); };
  for (let i = 0; i < fingerprints.length; i++) {
    for (let j = i + 1; j < fingerprints.length; j++) {
      if (similar(fingerprints[i], fingerprints[j], similarityThreshold)) union(i, j);
    }
  }
  const groups = new Map<number, StarEventFingerprint[]>();
  fingerprints.forEach((fp, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), fp]));

  const clusters: EventCluster[] = [];
  for (const members of groups.values()) {
    const sortedHashes = members.map((m) => m.contentHash).sort();
    const counts = new Map<string, number>();
    for (const m of members) for (const k of m.semanticFingerprint) counts.set(k, (counts.get(k) ?? 0) + 1);
    clusters.push({
      clusterId: (await sha256hex(sortedHashes.join('|'))).slice(0, 24),
      members,
      observationCount: members.length,
      sourceCount: new Set(members.map((m) => m.sourceId)).size,
      firstObservedAt: members.map((m) => m.observedAt).sort()[0],
      lastObservedAt: members.map((m) => m.observedAt).sort().at(-1) ?? '',
      dominantEventType: members[0].eventType,
      keywords: [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8).map(([k]) => k),
    });
  }
  return clusters.sort((a, b) => a.clusterId.localeCompare(b.clusterId));
}

// ── Narrative candidate (candidate ONLY — identity stays with STAR) ──

export interface NarrativeCandidate {
  candidateId: string;
  eventClusterId: string;
  suggestedLabel: string;
  observationCount: number;
  sourceCount: number;
  keywords: string[];
  assetCandidates: string[];
  /** Identification confidence of the clustering, NOT market confidence. */
  confidence: number;
}

export function narrativeCandidateFromCluster(cluster: EventCluster): NarrativeCandidate {
  return {
    candidateId: `narcand-${cluster.clusterId}`,
    eventClusterId: cluster.clusterId,
    suggestedLabel: cluster.keywords.slice(0, 2).join('-') || cluster.dominantEventType,
    observationCount: cluster.observationCount,
    sourceCount: cluster.sourceCount,
    keywords: cluster.keywords,
    assetCandidates: [...new Set(cluster.members.flatMap((m) => m.assetCandidates))],
    confidence: Number(Math.min(1, 0.4 + 0.2 * cluster.sourceCount + 0.1 * cluster.observationCount).toFixed(2)),
  };
}

// ── Evidence emission: external-event-candidate only, gate eligibility = [] by contract ──

let seq = 0;

export async function buildEventEvidence(clusters: EventCluster[], observedAt: string): Promise<EvidenceRecord[]> {
  const records: EvidenceRecord[] = [];
  for (const cluster of clusters) {
    records.push({
      evidenceId: `ev-event-${++seq}`,
      contractVersion: EVIDENCE_CONTRACT_VERSION,
      cap: 'CAP-01-EVENT',
      source: EVENT_INTEL_SOURCE,
      adapter: EVENT_INTEL_ADAPTER,
      sourceVersion: EVENT_INTEL_VERSION,
      entityType: 'event',
      entityId: cluster.clusterId,
      factType: 'external-event-candidate',
      value: {
        label: narrativeCandidateFromCluster(cluster).suggestedLabel,
        eventType: cluster.dominantEventType,
        observationCount: cluster.observationCount,
        sourceCount: cluster.sourceCount,
        keywords: cluster.keywords,
      },
      observedAt,
      slot: null,
      txSignatures: [],
      confidence: null,
      provenance: { method: 'fingerprint-cluster:jaccard' },
    });
  }
  for (const r of records) assertEvidence(r);
  return records;
}
