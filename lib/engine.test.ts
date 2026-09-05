/* eslint-disable @typescript-eslint/no-explicit-any -- untrusted external JSON is parsed defensively at this boundary */
/**
 * Point-in-time gate evaluation over the seeded fixture timeline.
 * Timeline anchors at 2026-09-02T00:00:00Z, so cutoffs are deterministic:
 *   T-18d = 08-15 (authorities live) … T-9d = 08-24 (related-wallets PASS).
 */
import { describe, beforeAll, it, expect } from 'vitest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

process.env.PGLITE_DATA_DIR = mkdtempSync(join(tmpdir(), 'star-engine-'));

let db: any;
let evaluateProjectAsOf: (db: any, projectId: string, asOf: Date) => Promise<any>;
let refreshProject: (db: any, projectId: string, asOf?: Date) => Promise<any>;
let schema: typeof import('@/db/schema');

beforeAll(async () => {
  const { getDb } = await import('@/db/client');
  db = await getDb();
  const { seedDatabase } = await import('@/db/seed');
  await seedDatabase(db);
  const engine = await import('@/lib/engine');
  evaluateProjectAsOf = engine.evaluateProjectAsOf;
  refreshProject = engine.refreshProject;
  schema = await import('@/db/schema');
});

const at = (iso: string) => new Date(iso);
const gateOf = (ev: any, gate: string) => ev.gates.find((g: any) => g.gate === gate);

describe('point-in-time gates — proj-neural', () => {
  it('08-16: authorities live → token-permissions FAIL, thin liquidity, concentrated holders, no score', async () => {
    const ev = await evaluateProjectAsOf(db, 'proj-neural', at('2026-08-16T23:00:00Z'));
    expect(gateOf(ev, 'token-permissions').status).toBe('FAIL');
    expect(gateOf(ev, 'liquidity').status).toBe('FAIL');
    expect(gateOf(ev, 'concentration').status).toBe('FAIL');
    expect(gateOf(ev, 'tradability').status).toBe('UNKNOWN');
    expect(gateOf(ev, 'program-verification').status).toBe('UNKNOWN');
    expect(ev.allPass).toBe(false);
    expect(ev.score).toBeNull();
    expect(ev.readiness).toBe('BLOCKED');
  });

  it('does NOT see the 08-18 authority revocation when replaying 08-16 (DATA-001)', async () => {
    const ev = await evaluateProjectAsOf(db, 'proj-neural', at('2026-08-16T23:00:00Z'));
    const checks = gateOf(ev, 'token-permissions').checks;
    expect(checks.find((c: any) => c.key === 'mint-authority').status).toBe('FAIL');
    expect(ev.evidenceUsed.every((e: any) => e.observedAt <= '2026-08-16T23:00:00.000Z')).toBe(true);
  });

  it('08-19: authorities revoked → token-permissions PASS, liquidity still thin (DATA-003 overturn)', async () => {
    const ev = await evaluateProjectAsOf(db, 'proj-neural', at('2026-08-19T12:00:00Z'));
    expect(gateOf(ev, 'token-permissions').status).toBe('PASS');
    expect(gateOf(ev, 'liquidity').status).toBe('FAIL');
  });

  it('08-23: liquidity + program PASS, holders still concentrated; tradability UNKNOWN (F2-A interregnum)', async () => {
    const ev = await evaluateProjectAsOf(db, 'proj-neural', at('2026-08-23T12:00:00Z'));
    expect(gateOf(ev, 'liquidity').status).toBe('PASS');
    // F2-A: adapter verdict removed, E-01 interpreter pending (F2-B) → UNKNOWN.
    expect(gateOf(ev, 'tradability').status).toBe('UNKNOWN');
    expect(gateOf(ev, 'program-verification').status).toBe('PASS');
    expect(gateOf(ev, 'concentration').status).toBe('FAIL');
    expect(ev.score).toBeNull();
    expect(ev.readiness).toBe('BLOCKED');
  });

  it('08-25: five gates PASS but tradability stays UNKNOWN (F2-A interregnum) → no score, no READY', async () => {
    const ev = await evaluateProjectAsOf(db, 'proj-neural', at('2026-08-25T12:00:00Z'));
    expect(ev.gates.filter((g: any) => g.status === 'PASS')).toHaveLength(5);
    expect(gateOf(ev, 'tradability').status).toBe('UNKNOWN');
    expect(ev.score).toBeNull();
    expect(ev.readiness).toBe('RESEARCH_REQUIRED');
  });

  it('before any evidence: every gate UNKNOWN (GATE-008 fail-closed), readiness RESEARCH_REQUIRED', async () => {
    const ev = await evaluateProjectAsOf(db, 'proj-neural', at('2026-08-01T00:00:00Z'));
    expect(ev.gates.every((g: any) => g.status === 'UNKNOWN')).toBe(true);
    expect(ev.score).toBeNull();
    expect(ev.readiness).toBe('RESEARCH_REQUIRED');
  });
});

describe('blocked projects never score (GATE-007/008)', () => {
  it('proj-honeypot: no sell route → tradability UNKNOWN (F2-A interregnum), cluster 70% → related-wallets FAIL', async () => {
    const ev = await evaluateProjectAsOf(db, 'proj-honeypot', at('2026-09-01T00:00:00Z'));
    expect(gateOf(ev, 'token-permissions').status).toBe('FAIL');
    expect(gateOf(ev, 'tradability').status).toBe('UNKNOWN');
    expect(gateOf(ev, 'related-wallets').status).toBe('FAIL');
    expect(gateOf(ev, 'liquidity').status).toBe('FAIL');
    expect(ev.score).toBeNull();
    expect(ev.readiness).toBe('BLOCKED');
  });

  it('anti-regression: concentration PASS can NOT substitute related-wallets FAIL (proj-llm-lab)', async () => {
    const ev = await evaluateProjectAsOf(db, 'proj-llm-lab', at('2026-09-01T00:00:00Z'));
    expect(gateOf(ev, 'concentration').status).toBe('PASS'); // top10 = 31% ≤ 35%
    expect(gateOf(ev, 'related-wallets').status).toBe('FAIL'); // team cluster = 55%
    expect(ev.score).toBeNull();
    expect(ev.readiness).toBe('BLOCKED');
    expect(ev.blockedBy).toContain('related-wallets:FAIL');
  });

  it('proj-rocket: live mint authority, concentrated holders, unproven LP lock', async () => {
    const ev = await evaluateProjectAsOf(db, 'proj-rocket', at('2026-09-01T00:00:00Z'));
    expect(gateOf(ev, 'token-permissions').status).toBe('FAIL');
    expect(gateOf(ev, 'concentration').status).toBe('FAIL');
    expect(gateOf(ev, 'liquidity').status).toBe('UNKNOWN');
    expect(ev.score).toBeNull();
  });
});

describe('temporal quarantine', () => {
  it('quarantines evidence rows where observedAt > ingestedAt', async () => {
    await db.insert(schema.evidence).values({
      projectId: 'proj-neural',
      type: 'liquidity',
      observedAt: at('2026-09-01T00:00:00Z'),
      effectiveAt: at('2026-09-01T00:00:00Z'),
      ingestedAt: at('2026-08-01T00:00:00Z'), // learned before observed — impossible
      source: 'time-traveler',
      payload: { pools: [], tvlUsdTotal: 9_999_999 },
      conclusion: 'bogus future fact',
    });
    const ev = await evaluateProjectAsOf(db, 'proj-neural', at('2026-09-02T12:00:00Z'));
    expect(ev.quarantined.length).toBe(1);
    const liquidityGate = gateOf(ev, 'liquidity');
    const usedIds = liquidityGate.checks.filter((c: any) => c.evidence).map((c: any) => c.evidence.source);
    expect(usedIds).not.toContain('time-traveler');
  });
});

describe('refreshProject persistence', () => {
  it('writes six gate-group rows and a score row only when earned', async () => {
    const ev = await refreshProject(db, 'proj-neural', at('2026-08-23T12:00:00Z'));
    expect(ev.score).toBeNull();
    const gates = await db.select().from(schema.gates);
    const neural = gates.filter((g: any) => g.projectId === 'proj-neural');
    expect(neural).toHaveLength(6);
    expect(neural.map((g: any) => g.category).sort()).toEqual([
      'concentration', 'liquidity', 'program-verification', 'related-wallets', 'token-permissions', 'tradability',
    ].sort());
  });
});
