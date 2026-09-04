/**
 * EvidenceEligibilityPolicy (R5-12). Marks facts that must not enter gates.
 * Health must not import this into interpretCheck / scoring.
 */
import * as s from '@/db/schema';
import type { StarDb } from '@/lib/db';

export type IneligibilityReason =
  | 'CONTESTED'
  | 'CONTRADICTED'
  | 'ERASED'
  | 'REPLAY_SOURCE_PURGED'
  | 'STALE';

/**
 * Deterministic reason precedence (single normative answer when multiple apply):
 * PURGED → ERASED → CONTRADICTED → CONTESTED → STALE → ELIGIBLE.
 * Earlier = more fundamental (content legally gone beats conflict beats age).
 */
export const REASON_PRECEDENCE: IneligibilityReason[] = [
  'REPLAY_SOURCE_PURGED',
  'ERASED',
  'CONTRADICTED',
  'CONTESTED',
  'STALE',
];

/** SLA per fact_kind (max age ms) — versioned policy artifact (R5-11). */
export interface StalenessPolicy {
  policy_version: string;
  max_age_ms: Record<string, number>;
  default_max_age_ms: number;
}

export const STALENESS_POLICY_V1: StalenessPolicy = {
  policy_version: 'eligibility-stale@1',
  // Liquidity/tradability age fastest (market state); authorities slower; program slowest.
  max_age_ms: {
    liquidity: 24 * 3600_000,
    'sell-simulation': 24 * 3600_000,
    'holder-distribution': 72 * 3600_000,
    'related-wallets': 72 * 3600_000,
    'mint-authority': 7 * 24 * 3600_000,
    'freeze-authority': 7 * 24 * 3600_000,
    'program-verification': 14 * 24 * 3600_000,
  },
  default_max_age_ms: 72 * 3600_000,
};

/**
 * STALE is computed against the caller-supplied evaluation instant — NEVER
 * Date.now(): historical replay must not drift as wall-clock time advances.
 * HISTORICAL passes the historical asOf; REINTERPRET passes an explicit
 * evaluation_at together with the chosen policy version.
 */
export function isStale(args: {
  observedAt: string | Date;
  evaluationAt: string | Date;
  factKind: string;
  policy: StalenessPolicy;
}): boolean {
  const observed = new Date(args.observedAt).getTime();
  const evaluation = new Date(args.evaluationAt).getTime();
  const maxAge = args.policy.max_age_ms[args.factKind] ?? args.policy.default_max_age_ms;
  return evaluation - observed > maxAge;
}

export type IneligibleFact = {
  factId: string;
  receiptId: string;
  subjectId: string;
  factKind: string;
  payloadHash: string;
  reason: IneligibilityReason;
};

type RelationRow = typeof s.receiptRelations.$inferSelect;
type ContestRow = typeof s.contestResolutions.$inferSelect;
type FactRelRow = typeof s.factRelations.$inferSelect;
type FactResRow = typeof s.factResolutions.$inferSelect;
type FactRow = typeof s.normalizedFacts.$inferSelect;
type EraseRow = typeof s.factErasures.$inferSelect;
type DispRow = typeof s.rawDispositions.$inferSelect;

export function projectIneligibleFacts(args: {
  facts: FactRow[];
  receiptRelations: RelationRow[];
  contestResolutions: ContestRow[];
  factRelations: FactRelRow[];
  factResolutions: FactResRow[];
  erasures: EraseRow[];
  dispositions: DispRow[];
  /** Optional staleness evaluation: instant + policy. Absent => no STALE marks. */
  stale?: { evaluationAt: string | Date; policy: StalenessPolicy };
}): IneligibleFact[] {
  // Collect ALL applicable reasons per fact, then emit one per the frozen
  // precedence order — a CONTESTED+STALE fact answers CONTESTED, deterministically.
  const reasons = new Map<string, Set<IneligibilityReason>>();
  const factById = new Map(args.facts.map((f) => [f.id, f]));
  const factsOfReceipt = (receiptId: string) => args.facts.filter((f) => f.receiptId === receiptId);

  const mark = (fact: FactRow, reason: IneligibilityReason) => {
    if (!reasons.has(fact.id)) reasons.set(fact.id, new Set());
    reasons.get(fact.id)!.add(reason);
  };

  for (const rel of args.receiptRelations.filter((r) => r.relation === 'CONTESTS')) {
    const resolved = args.contestResolutions.find((c) => c.contestedRelation === rel.id);
    const ids = [rel.receiptId, rel.relatedReceiptId];
    for (const receiptId of ids) {
      if (resolved && resolved.resolvedReceiptId === receiptId) continue;
      for (const fact of factsOfReceipt(receiptId)) mark(fact, 'CONTESTED');
    }
  }

  for (const rel of args.factRelations.filter((r) => r.relation === 'CONTRADICTS')) {
    const resolved = args.factResolutions.find((c) => c.factRelationId === rel.id);
    for (const factId of [rel.factA, rel.factB]) {
      if (resolved && resolved.resolvedFactId === factId) continue;
      const fact = factById.get(factId);
      if (fact) mark(fact, 'CONTRADICTED');
    }
  }

  for (const erase of args.erasures.filter((e) => e.disposition === 'LICENSE_ERASED')) {
    const fact = factById.get(erase.factId);
    if (fact) mark(fact, 'ERASED');
  }

  const licensePurged = new Set(
    args.dispositions.filter((d) => d.eventType === 'PURGE_EXECUTED' && d.scope === 'LICENSE_ERASURE').map((d) => d.receiptId),
  );
  for (const receiptId of licensePurged) {
    for (const fact of factsOfReceipt(receiptId)) mark(fact, 'REPLAY_SOURCE_PURGED');
  }

  if (args.stale) {
    for (const fact of args.facts) {
      const row = fact as FactRow & { observedAt?: string; createdAt?: string };
      if (isStale({ observedAt: row.observedAt ?? row.createdAt ?? row.payloadHash, evaluationAt: args.stale.evaluationAt, factKind: fact.factKind, policy: args.stale.policy })) {
        mark(fact, 'STALE');
      }
    }
  }

  const out: IneligibleFact[] = [];
  for (const [factId, set] of reasons) {
    const reason = REASON_PRECEDENCE.find((r) => set.has(r))!;
    const fact = factById.get(factId)!;
    out.push({
      factId: fact.id,
      receiptId: fact.receiptId,
      subjectId: fact.subjectId,
      factKind: fact.factKind,
      payloadHash: fact.payloadHash,
      reason,
    });
  }
  return out;
}

export function evidenceKey(projectId: string, kind: string, payloadHash: string): string {
  return `${projectId}|${kind}|${payloadHash}`;
}

export async function loadIneligibleFacts(db: StarDb): Promise<IneligibleFact[]> {
  const [facts, receiptRelations, contestResolutions, factRelations, factResolutions, erasures, dispositions] = await Promise.all([
    db.select().from(s.normalizedFacts),
    db.select().from(s.receiptRelations),
    db.select().from(s.contestResolutions),
    db.select().from(s.factRelations),
    db.select().from(s.factResolutions),
    db.select().from(s.factErasures),
    db.select().from(s.rawDispositions),
  ]);
  return projectIneligibleFacts({
    facts, receiptRelations, contestResolutions, factRelations, factResolutions, erasures, dispositions,
  });
}

export function ineligibleEvidenceKeys(facts: IneligibleFact[]): Map<string, IneligibilityReason> {
  const map = new Map<string, IneligibilityReason>();
  for (const f of facts) map.set(evidenceKey(f.subjectId, f.factKind, f.payloadHash), f.reason);
  return map;
}
