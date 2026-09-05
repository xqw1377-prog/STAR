/**
 * M0 Evidence Contract — the machine-readable form of
 * docs/alpha/EXTERNAL-CAPABILITY-MATRIX.md (Acquisition Matrix V1).
 *
 * Every external capability organ feeds raw observations through this
 * contract. Evidence is NOT a score: composite scores / verdicts / ratings
 * from external projects can never become Evidence and never reach a gate.
 * Gate eligibility is a WHITELIST over the real runtime gate keys
 * (lib/domain/types.ts gateKeys) — unmapped fact types have no gate path.
 * Sources must be ENABLED in the registry before any evidence is recorded
 * (fail-closed, no runtime override).
 */
import type { GateKey } from '@/lib/domain/types';
import { assertSourceEnabled } from '@/lib/data/source-registry';

export const EVIDENCE_CONTRACT_VERSION = 'star-evidence@1';

// ── Capability packages (CAP registry) ──

export type CapId =
  | 'CAP-01-EVENT'
  | 'CAP-02-CHAIN'
  | 'CAP-03-ACTOR'
  | 'CAP-04-TOKEN-PROGRAM'
  | 'CAP-05-MARKET'
  | 'CAP-06-EVIDENCE-KERNEL';

/** A = direct absorb · B = architecture absorb · C = algorithm rewrite · D = reference only. */
export type AbsorbGrade = 'A' | 'B' | 'C' | 'D';

export const CAP_REGISTRY: Record<CapId, { name: string; grade: AbsorbGrade; source: string; note: string }> = {
  'CAP-01-EVENT': { name: 'Event Intelligence', grade: 'C', source: 'alpharidge-ai (MIT)', note: 'schema rewrite; clustering is STAR-built; repo lacks the cross-article engine' },
  'CAP-02-CHAIN': { name: 'Chain Observation', grade: 'B', source: 'solana-realtime-indexer (MIT)', note: 'absorb checkpoint/gap/replay/backfill/DLQ architecture, not the business schema' },
  'CAP-03-ACTOR': { name: 'Money / Actor Intelligence', grade: 'C', source: 'dec-clust + find-the-insiders (NO LICENSE)', note: 'algorithm rewrite only — no license, no code copying; mock-data fallback patterns forbidden' },
  'CAP-04-TOKEN-PROGRAM': { name: 'Token / Program Risk', grade: 'A', source: 'solana-rugcheck-skill (MIT)', note: 'raw inspection only (byte-level SPL decode, TLV extension presence, upgrade authority); its doc-level scoring rubric is NOT absorbed' },
  'CAP-05-MARKET': { name: 'Market Truth', grade: 'B', source: 'STAR native', note: 'liquidity/sellability/impact/exit — STAR owns this' },
  'CAP-06-EVIDENCE-KERNEL': { name: 'Evidence Kernel', grade: 'A', source: 'STAR native', note: 'observation → evidence → truth → gate — 100% STAR' },
};

// ── Entity & fact types ──

export type EntityType = 'event' | 'narrative' | 'asset' | 'wallet' | 'pool' | 'program' | 'cluster';

/**
 * Raw observation fact types ONLY. No score, verdict, rating or composite
 * may appear here — enforced by contract tests. A fact type not in this
 * list is not evidence and has no gate path.
 */
export const EVIDENCE_FACT_TYPES = [
  // CAP-04 token / program risk
  'mint-authority-state',
  'freeze-authority-state',
  'token-2022-extensions',
  'program-upgrade-authority',
  'holder-top-accounts',
  // CAP-03 actor intelligence
  'funding-transfer',
  'funding-relation',
  'early-buyer',
  'fresh-wallet',
  'coordinated-activity',
  // CAP-02 chain observation (observation layer, never gate input)
  'asset-birth',
  'pool-book',
  // CAP-01 external intelligence (candidate only, NEVER gate-eligible)
  'external-event-candidate',
] as const;

export type EvidenceFactType = (typeof EVIDENCE_FACT_TYPES)[number];

// ── Gate eligibility: whitelist over the REAL runtime gate keys ──

export const GATE_ELIGIBLE_EVIDENCE: Record<EvidenceFactType, readonly GateKey[]> = {
  'mint-authority-state': ['token-permissions'],
  'freeze-authority-state': ['token-permissions'],
  'token-2022-extensions': ['token-permissions'],
  'program-upgrade-authority': ['program-verification'],
  'holder-top-accounts': ['concentration'],
  'funding-transfer': [],
  'funding-relation': ['related-wallets'],
  'coordinated-activity': ['related-wallets'],
  'early-buyer': ['related-wallets'],
  'fresh-wallet': ['related-wallets'],
  // Observation layer: feeds lifecycle/anchors, never a gate.
  'asset-birth': [],
  'pool-book': [],
  // External intelligence tops out at CANDIDATE. NEVER gate-eligible.
  'external-event-candidate': [],
};

/** Gate path for a fact type. Empty = no gate eligibility, by design. */
export function gateEligibility(factType: EvidenceFactType): readonly GateKey[] {
  return GATE_ELIGIBLE_EVIDENCE[factType] ?? [];
}

// ── Evidence record & fail-closed validation ──

export interface EvidenceRecord {
  evidenceId: string;
  contractVersion: typeof EVIDENCE_CONTRACT_VERSION;
  cap: CapId;
  /** Registry source id — must be ENABLED at record time. */
  source: string;
  adapter: string;
  sourceVersion?: string;
  entityType: EntityType;
  entityId: string;
  factType: EvidenceFactType;
  /** Raw observation payload. Never a score or verdict. */
  value: Record<string, unknown>;
  /** ISO UTC observation time. */
  observedAt: string;
  slot?: number | null;
  txSignatures?: string[];
  /** Identification confidence (e.g. entity resolution), NOT market confidence. May be null. */
  confidence?: number | null;
  provenance: { rawRef?: string; method?: string };
}

export class EvidenceContractViolation extends Error {}

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

function fail(why: string): never {
  throw new EvidenceContractViolation(`evidence contract: ${why}`);
}

/** Fail-closed validation. Throws EvidenceContractViolation on any breach. */
export function assertEvidence(e: EvidenceRecord): void {
  if (e.contractVersion !== EVIDENCE_CONTRACT_VERSION) fail(`contractVersion must be ${EVIDENCE_CONTRACT_VERSION}`);
  if (!e.evidenceId) fail('evidenceId required');
  if (!CAP_REGISTRY[e.cap]) fail(`unknown cap ${e.cap}`);
  if (!e.adapter) fail('adapter required');
  if (!e.entityId) fail('entityId required');
  if (!(EVIDENCE_FACT_TYPES as readonly string[]).includes(e.factType)) {
    fail(`unknown factType ${e.factType} (raw observation types only; scores/verdicts are not evidence)`);
  }
  if (!ISO_UTC.test(e.observedAt)) fail(`observedAt must be ISO UTC, got ${e.observedAt}`);
  if (!e.value || typeof e.value !== 'object') fail('value payload required');
  if (e.confidence != null && (e.confidence < 0 || e.confidence > 1)) fail('confidence must be within [0,1] when present');
  // Source gating: fail-closed. Unlicensed sources cannot record evidence.
  try {
    assertSourceEnabled(e.source);
  } catch {
    fail(`source '${e.source}' is not ENABLED in the registry; evidence recording is refused`);
  }
}

// ── Adapter contract: organs, not brains ──

/**
 * Every external capability organ implements this. Adapters produce raw
 * observations as EvidenceRecords; they never mutate narrative identity,
 * lifecycle, consensus, gates or decisions (FROZEN-rev1 §16).
 */
export interface ExternalEvidenceAdapter {
  id: string;
  cap: CapId;
  /** Registry source id this adapter records on behalf of. */
  sourceId: string;
}
