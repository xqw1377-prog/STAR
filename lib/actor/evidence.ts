/**
 * M2 Actor Evidence — funding graph, actor clusters, coordinated activity,
 * fresh wallets. Algorithm rewrite (dec-clust + find-the-insiders ideas;
 * both repos UNLICENSED — zero code copied, per Acquisition Matrix V1 rule).
 *
 * Invariant (matrix §六): Cluster ≠ Risk. This module computes and emits
 * observations-as-evidence only. It never computes a risk score, never
 * labels a cluster "insider"/"cabal", and never touches gates or decisions.
 */
import type { EvidenceRecord } from '@/lib/evidence/contract';
import { EVIDENCE_CONTRACT_VERSION } from '@/lib/evidence/contract';
import { sha256hex } from '@/lib/data/hash';
import { assertEvidence } from '@/lib/evidence/contract';

export const ACTOR_ENGINE_VERSION = 'star-actor@1';
export const ACTOR_SOURCE = 'synthetic-fixtures';
export const ACTOR_ADAPTER = 'actor-graph-fixture';

// ── Inputs (observation-layer shapes) ──

export interface FundingTransferObs {
  from: string;
  to: string;
  slot: number;
  lamports: number;
  signature: string;
}

export interface TokenBuyObs {
  wallet: string;
  mint: string;
  slot: number;
  signature: string;
}

export interface WalletActivityObs {
  wallet: string;
  txCount: number;
}

// ── Graph computation ──

export interface FundingRelation {
  parent: string;
  child: string;
  firstSlot: number;
  slots: number[];
  lamports: number;
}

export interface ActorClusterCandidate {
  /** Identification only — the word "cluster" carries no risk judgment. */
  parentWallet: string;
  children: string[];
  fanOutCount: number;
  firstFundingSlot: number;
  lastFundingSlot: number;
  fundingSpanSlots: number;
}

export interface CoordinatedActivity {
  mint: string;
  wallets: string[];
  firstSlot: number;
  lastSlot: number;
  windowSlots: number;
}

/** Group transfers into parent→child relations and parent-keyed clusters (≥2 children). */
export function buildFundingGraph(transfers: FundingTransferObs[]): {
  relations: FundingRelation[];
  clusters: ActorClusterCandidate[];
} {
  const byEdge = new Map<string, FundingTransferObs[]>();
  for (const t of transfers) {
    const key = `${t.from}->${t.to}`;
    byEdge.set(key, [...(byEdge.get(key) ?? []), t]);
  }
  const relations: FundingRelation[] = [...byEdge.entries()].map(([key, list]) => ({
    parent: key.split('->')[0],
    child: key.split('->')[1],
    firstSlot: Math.min(...list.map((t) => t.slot)),
    slots: list.map((t) => t.slot).sort((a, b) => a - b),
    lamports: list.reduce((sum, t) => sum + t.lamports, 0),
  }));

  const byParent = new Map<string, FundingRelation[]>();
  for (const r of relations) byParent.set(r.parent, [...(byParent.get(r.parent) ?? []), r]);
  const clusters: ActorClusterCandidate[] = [];
  for (const [parent, edges] of byParent) {
    if (edges.length < 2) continue;
    const slots = edges.flatMap((e) => e.slots);
    clusters.push({
      parentWallet: parent,
      children: edges.map((e) => e.child).sort(),
      fanOutCount: edges.length,
      firstFundingSlot: Math.min(...slots),
      lastFundingSlot: Math.max(...slots),
      fundingSpanSlots: Math.max(...slots) - Math.min(...slots),
    });
  }
  return { relations, clusters: clusters.sort((a, b) => a.parentWallet.localeCompare(b.parentWallet)) };
}

/** ≥2 wallets buying the same mint within a slot window — recorded as activity, not malice. */
export function detectCoordinatedActivity(buys: TokenBuyObs[], windowSlots: number): CoordinatedActivity | null {
  const byMint = new Map<string, TokenBuyObs[]>();
  for (const b of buys) byMint.set(b.mint, [...(byMint.get(b.mint) ?? []), b]);
  for (const [mint, list] of byMint) {
    const sorted = [...list].sort((a, b) => a.slot - b.slot);
    if (sorted.length < 2) continue;
    const first = sorted[0];
    const inWindow = sorted.filter((b) => b.slot - first.slot <= windowSlots);
    const unique = new Set(inWindow.map((b) => b.wallet));
    if (unique.size >= 2) {
      return {
        mint,
        wallets: [...unique].sort(),
        firstSlot: first.slot,
        lastSlot: inWindow[inWindow.length - 1].slot,
        windowSlots,
      };
    }
  }
  return null;
}

export function freshWallets(activity: WalletActivityObs[], maxTxCount: number): WalletActivityObs[] {
  return activity.filter((a) => a.txCount <= maxTxCount).sort((a, b) => a.wallet.localeCompare(b.wallet));
}

// ── Evidence emission (M0 contract; every record validated) ──

let seq = 0;
async function nextId(): Promise<string> {
  seq += 1;
  return `ev-actor-${await sha256hex(`${ACTOR_ENGINE_VERSION}|${seq}|${Date.now()}`)}`.slice(0, 40);
}

export interface ActorEvidenceInput {
  transfers: FundingTransferObs[];
  buys: TokenBuyObs[];
  walletActivity: WalletActivityObs[];
  /** Birth slot per mint — early = bought within N slots after birth. */
  births: Array<{ mint: string; slot: number }>;
  fundingWindowSlots?: number;
  coordinationWindowSlots?: number;
  freshMaxTxCount?: number;
  observedAt: string;
}

export async function buildActorEvidence(input: ActorEvidenceInput): Promise<EvidenceRecord[]> {
  const { relations, clusters } = buildFundingGraph(input.transfers);
  const coordinated = detectCoordinatedActivity(input.buys, input.coordinationWindowSlots ?? 30);
  const fresh = freshWallets(input.walletActivity, input.freshMaxTxCount ?? 3);
  const birthOf = new Map(input.births.map((b) => [b.mint, b.slot]));
  const early = input.buys.filter((b) => {
    const birth = birthOf.get(b.mint);
    return birth != null && b.slot - birth <= (input.fundingWindowSlots ?? 60);
  });

  const records: EvidenceRecord[] = [];
  for (const cluster of clusters) {
    records.push({
      evidenceId: await nextId(),
      contractVersion: EVIDENCE_CONTRACT_VERSION,
      cap: 'CAP-03-ACTOR',
      source: ACTOR_SOURCE,
      adapter: ACTOR_ADAPTER,
      sourceVersion: ACTOR_ENGINE_VERSION,
      entityType: 'cluster',
      entityId: `${cluster.parentWallet}->[${cluster.children.join(',')}]`,
      factType: 'funding-relation',
      value: {
        parent: cluster.parentWallet,
        child: cluster.children[0],
        children: cluster.children,
        fanOutCount: cluster.fanOutCount,
        firstFundingSlot: cluster.firstFundingSlot,
        fundingSpanSlots: cluster.fundingSpanSlots,
      },
      observedAt: input.observedAt,
      slot: cluster.firstFundingSlot,
      txSignatures: relations.filter((r) => r.parent === cluster.parentWallet).map((r) => `${r.parent}->${r.child}`),
      confidence: null,
      provenance: { method: 'funding-graph:common-parent' },
    });
  }
  if (coordinated) {
    records.push({
      evidenceId: await nextId(),
      contractVersion: EVIDENCE_CONTRACT_VERSION,
      cap: 'CAP-03-ACTOR',
      source: ACTOR_SOURCE,
      adapter: ACTOR_ADAPTER,
      sourceVersion: ACTOR_ENGINE_VERSION,
      entityType: 'cluster',
      entityId: `coordinated:${coordinated.mint}`,
      factType: 'coordinated-activity',
      value: { wallets: coordinated.wallets, behavior: 'same-mint-buys-in-window', mint: coordinated.mint, firstSlot: coordinated.firstSlot, windowSlots: coordinated.windowSlots },
      observedAt: input.observedAt,
      slot: coordinated.firstSlot,
      txSignatures: input.buys.filter((b) => coordinated.wallets.includes(b.wallet) && b.mint === coordinated.mint).map((b) => b.signature),
      confidence: null,
      provenance: { method: 'timing:slot-window' },
    });
  }
  for (const w of fresh) {
    records.push({
      evidenceId: await nextId(),
      contractVersion: EVIDENCE_CONTRACT_VERSION,
      cap: 'CAP-03-ACTOR',
      source: ACTOR_SOURCE,
      adapter: ACTOR_ADAPTER,
      sourceVersion: ACTOR_ENGINE_VERSION,
      entityType: 'wallet',
      entityId: w.wallet,
      factType: 'fresh-wallet',
      value: { wallet: w.wallet, txCount: w.txCount },
      observedAt: input.observedAt,
      slot: null,
      txSignatures: [],
      confidence: null,
      provenance: { method: 'tx-count-threshold' },
    });
  }
  for (const b of early) {
    records.push({
      evidenceId: await nextId(),
      contractVersion: EVIDENCE_CONTRACT_VERSION,
      cap: 'CAP-03-ACTOR',
      source: ACTOR_SOURCE,
      adapter: ACTOR_ADAPTER,
      sourceVersion: ACTOR_ENGINE_VERSION,
      entityType: 'wallet',
      entityId: `${b.wallet}:${b.mint}`,
      factType: 'early-buyer',
      value: { wallet: b.wallet, mint: b.mint, slot: b.slot, slotsAfterBirth: b.slot - (birthOf.get(b.mint) ?? b.slot) },
      observedAt: input.observedAt,
      slot: b.slot,
      txSignatures: [b.signature],
      confidence: null,
      provenance: { method: 'birth-relative-window' },
    });
  }

  for (const r of records) assertEvidence(r);
  return records;
}
