/**
 * M0 Evidence Contract acceptance. Frozen invariants:
 *  1. Evidence is never a score/verdict — no composite types on the whitelist.
 *  2. Gate eligibility is a whitelist over the REAL runtime gate keys;
 *     candidates and observation-layer facts have NO gate path.
 *  3. Fail-closed validation: unknown types, non-UTC times, and sources that
 *     are not ENABLED in the registry are all rejected.
 *  4. CAP grades match the code-audited Acquisition Matrix V1.
 */
import { describe, expect, it } from 'vitest';
import {
  CAP_REGISTRY,
  EVIDENCE_CONTRACT_VERSION,
  EVIDENCE_FACT_TYPES,
  EvidenceContractViolation,
  GATE_ELIGIBLE_EVIDENCE,
  assertEvidence,
  gateEligibility,
  type EvidenceRecord,
} from './contract';
import { gateKeys } from '@/lib/domain/types';

function fixture(over: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return {
    evidenceId: 'ev-test-1',
    contractVersion: EVIDENCE_CONTRACT_VERSION,
    cap: 'CAP-04-TOKEN-PROGRAM',
    source: 'synthetic-fixtures',
    adapter: 'rugcheck-raw-inspection',
    entityType: 'asset',
    entityId: 'PumpMint111111111111111111111111111111111',
    factType: 'mint-authority-state',
    value: { mintAuthority: null, decimals: 6 },
    observedAt: '2026-09-05T00:00:00.000Z',
    slot: 1200,
    txSignatures: [],
    confidence: null,
    provenance: { method: 'byte-decode:getAccountInfo' },
    ...over,
  };
}

describe('evidence contract — no score invariant', () => {
  it('whitelist contains no score/verdict/rating fact types', () => {
    const banned = EVIDENCE_FACT_TYPES.filter((t) => /score|verdict|rating|safety|risk[-_]?level/i.test(t));
    expect(banned).toEqual([]);
  });
});

describe('evidence contract — gate whitelist uses REAL runtime gate keys', () => {
  it('every mapped gate key exists in lib/domain/types.ts gateKeys', () => {
    const mapped = new Set(Object.values(GATE_ELIGIBLE_EVIDENCE).flat());
    for (const key of mapped) expect(gateKeys).toContain(key);
  });

  it('candidates and observation-layer facts have NO gate path', () => {
    expect(gateEligibility('external-event-candidate')).toEqual([]);
    expect(gateEligibility('asset-birth')).toEqual([]);
    expect(gateEligibility('pool-book')).toEqual([]);
  });

  it('token/program/holder/actor facts map to their real gates', () => {
    expect(gateEligibility('mint-authority-state')).toEqual(['token-permissions']);
    expect(gateEligibility('token-2022-extensions')).toEqual(['token-permissions']);
    expect(gateEligibility('program-upgrade-authority')).toEqual(['program-verification']);
    expect(gateEligibility('holder-top-accounts')).toEqual(['concentration']);
    expect(gateEligibility('funding-relation')).toEqual(['related-wallets']);
    expect(gateEligibility('coordinated-activity')).toEqual(['related-wallets']);
  });
});

describe('evidence contract — fail-closed validation', () => {
  it('accepts a contract-conforming raw observation', () => {
    expect(() => assertEvidence(fixture())).not.toThrow();
  });

  it('rejects unknown fact types (scores are structurally impossible)', () => {
    expect(() => assertEvidence(fixture({ factType: 'safety-score' as never }))).toThrow(EvidenceContractViolation);
  });

  it('rejects non-UTC observation times', () => {
    expect(() => assertEvidence(fixture({ observedAt: '2026-09-05T08:00:00+08:00' }))).toThrow(EvidenceContractViolation);
  });

  it('rejects sources that are not ENABLED in the registry', () => {
    // solana-rpc is now ENABLED (Helius, 2026-09-05) — use other blocked sources
    expect(() => assertEvidence(fixture({ source: 'ave-ai' }))).toThrow(/not ENABLED/);
    expect(() => assertEvidence(fixture({ source: 'jupiter-ultra' }))).toThrow(/not ENABLED/);
    expect(() => assertEvidence(fixture({ source: 'social' }))).toThrow(/not ENABLED/);
  });

  it('rejects out-of-range confidence and missing ids', () => {
    expect(() => assertEvidence(fixture({ confidence: 1.5 }))).toThrow(EvidenceContractViolation);
    expect(() => assertEvidence(fixture({ evidenceId: '' }))).toThrow(EvidenceContractViolation);
    expect(() => assertEvidence(fixture({ entityId: '' }))).toThrow(EvidenceContractViolation);
  });
});

describe('evidence contract — CAP registry matches the audited matrix', () => {
  it('holds the code-audited grades', () => {
    expect(CAP_REGISTRY['CAP-04-TOKEN-PROGRAM'].grade).toBe('A');
    expect(CAP_REGISTRY['CAP-02-CHAIN'].grade).toBe('B');
    expect(CAP_REGISTRY['CAP-03-ACTOR'].grade).toBe('C');
    expect(CAP_REGISTRY['CAP-01-EVENT'].grade).toBe('C');
    expect(CAP_REGISTRY['CAP-06-EVIDENCE-KERNEL'].grade).toBe('A');
  });

  it('records the no-license constraint on the actor package', () => {
    expect(CAP_REGISTRY['CAP-03-ACTOR'].source).toMatch(/NO LICENSE/);
  });
});
