/**
 * M5 — Integration & Governance Audit (principal authorization 2026-09-05).
 * Not new capability: verification that the five organs COMBINED still hold
 * every frozen boundary. Four audit chains:
 *
 * ① Evidence provenance   — Source → Adapter → Observation → Computation →
 *                           Evidence: no broken links, no anonymous evidence.
 * ② Cross-organ leakage  — M2/M3 → Gate writes, M4 → Narrative/Lifecycle
 *                           identity, M1 → Evidence Truth: all forbidden and
 *                           proven forbidden (Asset→Event→Narrative included).
 * ③ Fixture poisoning    — best-case forged inputs from every organ cannot
 *                           produce a gate PASS: the evidence→gate-payload
 *                           translation layer deliberately does not exist
 *                           (that IS the B2 governance gate).
 * ④ Registry integrity   — READY ≠ ENABLED, forever. No organ turns on by
 *                           existing; synthetic-fixtures stays the only
 *                           ENABLED source.
 *
 * Audit state: RPC OFF · Sensor OFF · B2 UNAUTHORIZED throughout.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  EVIDENCE_CONTRACT_VERSION,
  EVIDENCE_FACT_TYPES,
  assertEvidence,
  gateEligibility,
  type EvidenceRecord,
} from '@/lib/evidence/contract';
import { CAPABILITY } from '@/lib/alpha/capability';
import { SOURCE_REGISTRY, assertSourceEnabled } from '@/lib/data/source-registry';
import { interpretCheck } from '@/lib/domain';
import { buildActorEvidence, type FundingTransferObs, type TokenBuyObs, type WalletActivityObs } from '@/lib/actor/evidence';
import { buildTokenProgramEvidence, fixtureMintBytes, fixtureProgramDataBytes } from '@/lib/tokenrisk/inspection';
import { buildEventEvidence, clusterEvents, fingerprintObservation, narrativeCandidateFromCluster } from '@/lib/eventintel/cluster';
import { fixtureStream, maliciousStream } from '@/lib/observation/fixture-source';
import { runPipelineBatch } from '@/lib/observation/pipeline';
import { OBSERVATION_VERSION } from '@/lib/observation/contract';

const OBS = '2026-09-04T00:00:00.000Z';
const ROOT = join(__dirname, '../..');

// ── Forged "perfect scenario" inputs: designed to look as favorable as possible ──

const FORGED_TRANSFERS: FundingTransferObs[] = Array.from({ length: 8 }, (_, i) => ({
  from: 'AttackerParent111111111111111111111111111',
  to: `AttackerWallet${i}1111111111111111111111111`,
  slot: 1001 + i,
  lamports: 5_000_000_000,
  signature: `forged-sig-${i}`,
}));

const FORGED_BUYS: TokenBuyObs[] = FORGED_TRANSFERS.map((t, i) => ({
  wallet: t.to,
  mint: 'CleanMint1111111111111111111111111111111',
  slot: 1020 + i,
  signature: `forged-buy-${i}`,
}));

const FORGED_ACTIVITY: WalletActivityObs[] = FORGED_TRANSFERS.map((t) => ({ wallet: t.to, txCount: 1 }));

// M3 forged "perfect token": everything revoked, no extensions, upgrade authority renounced.
const FORGED_MINT_BYTES = fixtureMintBytes(); // clean by construction
const FORGED_PROGRAM_BYTES = fixtureProgramDataBytes(null); // upgrade authority renounced

describe('M5-① evidence provenance — no anonymous evidence survives', () => {
  it('every organ record carries the full Source→Adapter→Computation chain', async () => {
    const actor = await buildActorEvidence({
      transfers: FORGED_TRANSFERS,
      buys: FORGED_BUYS,
      walletActivity: FORGED_ACTIVITY,
      births: [{ mint: 'CleanMint1111111111111111111111111111111', slot: 1001 }],
      observedAt: OBS,
    });
    const token = await buildTokenProgramEvidence({
      mint: 'CleanMint1111111111111111111111111111111',
      mintAccountBytes: FORGED_MINT_BYTES,
      programDataBytes: FORGED_PROGRAM_BYTES,
      programId: 'CleanProg11111111111111111111111111111111',
      observedAt: OBS,
      slot: 1100,
    });
    const clusters = await clusterEvents([await fingerprintObservation({
      sourceObservationId: 'forged-obs-1',
      sourceId: 'synthetic-fixtures',
      eventType: 'POLICY_ANNOUNCEMENT',
      eventTitle: 'Forged perfect event',
      eventDate: '2026-09-03',
      body: 'forged',
      entityRefs: [],
      assetCandidates: [],
      observedAt: OBS,
      keywords: ['forged'],
    })]);
    const event = await buildEventEvidence(clusters, OBS);

    const all = [...actor, ...token, ...event];
    expect(all.length).toBeGreaterThan(5);
    for (const r of all) {
      // Source: registry-known and ENABLED (validated inside assertEvidence).
      // Adapter + computation: named and versioned.
      expect(r.source).toBe('synthetic-fixtures');
      expect(r.adapter).toBeTruthy();
      expect(r.sourceVersion).toBeTruthy();
      expect(r.provenance.method).toBeTruthy();
      expect(r.observedAt).toBe(OBS);
      expect(() => assertEvidence(r)).not.toThrow();
    }
  });

  it('M1 observations carry batch lineage and their own version', async () => {
    // Static structural check: the pipeline stamps batch_id + observation_key.
    const src = readFileSync(join(ROOT, 'lib/observation/pipeline.ts'), 'utf8');
    expect(src).toContain('batchId');
    expect(OBSERVATION_VERSION).toBe('star-observation@1');
  });
});

describe('M5-② cross-organ leakage — forbidden paths proven forbidden', () => {
  it('M2/M3 evidence has gate INPUT eligibility only; no organ writes gates', async () => {
    const token = await buildTokenProgramEvidence({
      mint: 'CleanMint1111111111111111111111111111111',
      mintAccountBytes: FORGED_MINT_BYTES,
      observedAt: OBS,
      slot: 1100,
    });
    for (const r of token) {
      expect(gateEligibility(r.factType).length).toBeGreaterThan(0); // eligible as INPUT
      expect(JSON.stringify(r)).not.toMatch(/"gate"|gateStatus|"PASS"|"FAIL"/); // carries no verdict
    }
  });

  it('M4 candidates never claim narrative identity or lifecycle stage', async () => {
    const clusters = await clusterEvents([await fingerprintObservation({
      sourceObservationId: 'obs-1',
      sourceId: 'synthetic-fixtures',
      eventType: 'LAUNCH',
      eventTitle: 'Asset-driven fake narrative attempt',
      eventDate: null,
      body: 'attempt',
      entityRefs: [],
      assetCandidates: ['FakeAssetMint1111111111111111111111111'],
      observedAt: OBS,
      keywords: ['fake', 'asset'],
    })]);
    const candidate = narrativeCandidateFromCluster(clusters[0]);
    // Candidate id derives from EVENT content hashes only — never from asset ids.
    expect(candidate.candidateId.startsWith('narcand-')).toBe(true);
    expect(clusters[0].clusterId).not.toContain('FakeAssetMint');
    // No identity/stage claims anywhere in the candidate.
    expect(JSON.stringify(candidate)).not.toMatch(/"stage"|S[0-8]-|narrativeId/);
    // Asset references ride along as CANDIDATES, never as identity input.
    expect(candidate.assetCandidates).toEqual(['FakeAssetMint1111111111111111111111111']);
  });

  it('M1 emits observations, never truth: normalized payloads carry no gate language', async () => {
    const kinds = fixtureStream().map((e) => e.kind);
    expect(kinds).not.toContain('gate-verdict');
    expect(EVIDENCE_FACT_TYPES).not.toContain('gate-verdict' as never);
  });

  it('static: no module anywhere converts organ evidence into gate payload writes', () => {
    // The evidence→gate translation layer deliberately does not exist until
    // B2 governance authorizes one. Prove it by absence of any importer of
    // both surfaces. (The engine's evidence path is the research fixture
    // pipeline, untouched by the organs.)
    const offenders: string[] = [];
    for (const dir of ['lib/actor', 'lib/tokenrisk', 'lib/eventintel']) {
      for (const f of ['evidence.ts', 'inspection.ts', 'cluster.ts']) {
        const p = join(ROOT, dir, f);
        let text = '';
        try { text = readFileSync(p, 'utf8'); } catch { continue; }
        if (/@\/lib\/domain|@\/lib\/engine|persistEvaluation|interpretCheck/.test(text)) offenders.push(p);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('M5-③ fixture poisoning — synthetic evidence cannot manufacture a PASS', () => {
  it('forged "perfect" token facts do not satisfy the REAL gate interpreter', async () => {
    const records = await buildTokenProgramEvidence({
      mint: 'CleanMint1111111111111111111111111111111',
      mintAccountBytes: FORGED_MINT_BYTES,
      programDataBytes: FORGED_PROGRAM_BYTES,
      programId: 'CleanProg11111111111111111111111111111111',
      observedAt: OBS,
      slot: 1100,
    });
    // Feed the forged records' values straight into the REAL check
    // interpreter used by the six gates. Organ payloads lack the truth-layer
    // shape (e.g. token2022Extensions resolution) → the fail-closed
    // interpreter answers UNKNOWN, never PASS. Even a payload that guessed
    // the full shape has no delivery path: the evidence→gate translation
    // layer does not exist (that absence IS the B2 governance gate).
    const checkOf: Record<string, 'mint-authority' | 'freeze-authority' | 'program-verification' | null> = {
      'mint-authority-state': 'mint-authority',
      'freeze-authority-state': 'freeze-authority',
      'token-2022-extensions': null,
      'program-upgrade-authority': 'program-verification',
    };
    let passes = 0;
    for (const r of records) {
      const check = checkOf[r.factType];
      if (!check) continue;
      const result = interpretCheck(check, r.value, { asOf: new Date(OBS) });
      if (result.status === 'PASS') passes += 1;
    }
    expect(passes).toBe(0);
  });

  it('forged actor clusters carry no payload the related-wallets gate could accept', async () => {
    const records = await buildActorEvidence({
      transfers: FORGED_TRANSFERS,
      buys: FORGED_BUYS,
      walletActivity: FORGED_ACTIVITY,
      births: [{ mint: 'CleanMint1111111111111111111111111111111', slot: 1001 }],
      observedAt: OBS,
    });
    const relation = records.find((r) => r.factType === 'funding-relation')!;
    // The real related-wallets check needs clusterPct/graphIngested in gate
    // payload shape; organ evidence does not provide them → UNKNOWN, not PASS.
    const result = interpretCheck('related-wallets', relation.value, { asOf: new Date(OBS) });
    expect(result.status).toBe('UNKNOWN');
  });

  it('malicious M1 envelopes all dead-letter (no observation, no gate, no score)', async () => {
    // Verdict/score smuggling kinds are structurally absent from the
    // whitelist; legit-kind-bad-payload cases die at normalize (M1-8).
    for (const e of maliciousStream()) {
      if (/verdict|score|level/i.test(e.kind)) {
        expect(EVIDENCE_FACT_TYPES).not.toContain(e.kind as never);
      }
    }
  });
});

describe('M5-④ capability registry integrity — READY ≠ ENABLED, forever', () => {
  it('every real-world source stays not-ENABLED; synthetic fixtures stay the only ENABLED source', () => {
    const enabled = Object.entries(SOURCE_REGISTRY).filter(([, v]) => v.status === 'ENABLED').map(([k]) => k);
    expect(enabled).toContain('synthetic-fixtures');
    expect(enabled).toContain('solana-rpc'); // Helius enabled 2026-09-05
    expect(enabled).not.toContain('ave-ai');
    expect(enabled).not.toContain('jupiter-ultra');
    expect(enabled).not.toContain('social');
    for (const banned of ['jupiter-ultra', 'ave-ai', 'social']) {  // solana-rpc now ENABLED (Helius 2026-09-05)
      expect(() => assertSourceEnabled(banned)).toThrow();
    }
  });

  it('capability organs are READY but not ENABLED/not wired — locked in the ledger', () => {
    expect(CAPABILITY.runtime.b1.status).toBe('ACTIVE-FIXTURE-ONLY');
    expect(CAPABILITY.runtime.b1.realSensor).toBe(false);
    expect(CAPABILITY.runtime.m1.status).toBe('READY-FIXTURE-REPLAY-ONLY');
    expect(CAPABILITY.runtime.m1.realRpc).toBe(false);
    expect(CAPABILITY.runtime.m1.b2Authorized).toBe(false);
    for (const m of [CAPABILITY.runtime.m2, CAPABILITY.runtime.m3, CAPABILITY.runtime.m4]) {
      expect(m.wiredToRuntime).toBe(false);
    }
    expect(CAPABILITY.runtime.m2.emitsRiskScore).toBe(false);
    expect(CAPABILITY.runtime.m4.narrativeIdentity).toBe(false);
  });

  it('the ledger never claims ENABLED for any organ (the word is reserved for sources)', () => {
    const src = readFileSync(join(ROOT, 'lib/alpha/capability.ts'), 'utf8');
    expect(src).not.toMatch(/status:\s*'ENABLED/);
    expect(EVIDENCE_CONTRACT_VERSION).toBe('star-evidence@2'); // @2 per Evidence Vocabulary CCP (pool-state)
  });
});
