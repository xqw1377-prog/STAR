import { describe, expect, it } from 'vitest';
import { aggregateGates, evaluateChecksAt, evaluateGatesAt, scoringAllowed, toGateRecordsAsOf } from './gates';
import { HONEYPOT_CHECKS, LLM_LAB_CHECKS, NEURAL_CHECKS, ROCKET_CHECKS } from './synthetic-checks';
import { PRD_GATE_ALIAS, gateKeys, type GateKey } from './types';
import type { GateRecord } from './gates';

const at = (iso: string) => new Date(iso);
const gateOf = (checks: typeof NEURAL_CHECKS, when: string, project: string, key: GateKey) =>
  evaluateChecksAt(checks, at(when), project).results.find((r) => r.check_key === key);

function ev(check_key: GateKey, over: Partial<GateRecord> = {}): GateRecord {
  return {
    id: over.id ?? `e-${check_key}`,
    project_id: 'proj-1',
    check_key,
    status: over.status ?? 'PASS',
    claim: over.claim ?? `${check_key} resolved`,
    source: 'fixture',
    effective_at: over.effective_at ?? '2026-08-15T00:00:00Z',
    observed_at: over.observed_at ?? '2026-08-15T00:00:00Z',
    ingested_at: over.ingested_at ?? '2026-08-15T00:00:00Z',
    confidence: 0.9,
  };
}

function passing(): GateRecord[] {
  return gateKeys.map((key) => ev(key));
}

describe('evaluateGatesAt', () => {
  it('exposes exactly the six kebab categories', () => {
    const evaluation = evaluateGatesAt(passing(), new Date('2026-09-01T00:00:00Z'));
    expect(evaluation.results.map((r) => r.check_key)).toEqual([...gateKeys]);
    expect(evaluation.aggregate).toBe('PASS');
    expect(scoringAllowed(evaluation)).toBe(true);
  });

  it('does not expose mint or freeze as standalone gates', () => {
    const evaluation = evaluateGatesAt(passing(), new Date('2026-09-01T00:00:00Z'));
    expect(evaluation.results.find((r) => r.check_key === 'token-permissions')?.status).toBe('PASS');
    expect(evaluation.results.find((r) => r.check_key === 'related-wallets')?.status).toBe('PASS');
    expect(evaluation.results.some((r) => String(r.check_key).includes('mint') || String(r.check_key).includes('freeze'))).toBe(false);
  });

  it('is fail-closed when a kind is missing', () => {
    const withoutWallets = passing().filter((r) => r.check_key !== 'related-wallets');
    const evaluation = evaluateGatesAt(withoutWallets, new Date('2026-09-01T00:00:00Z'));
    expect(evaluation.results.find((r) => r.check_key === 'related-wallets')?.status).toBe('UNKNOWN');
    expect(evaluation.aggregate).toBe('UNKNOWN');
    expect(scoringAllowed(evaluation)).toBe(false);
  });

  it('does not let concentration PASS substitute for related-wallets', () => {
    const facts = passing().filter((r) => r.check_key !== 'related-wallets');
    const evaluation = evaluateGatesAt(facts, new Date('2026-09-01T00:00:00Z'));
    expect(evaluation.results.find((r) => r.check_key === 'concentration')?.status).toBe('PASS');
    expect(evaluation.results.find((r) => r.check_key === 'related-wallets')?.status).toBe('UNKNOWN');
    expect(scoringAllowed(evaluation)).toBe(false);
  });

  it('aggregates FAIL when any gate fails', () => {
    const facts = passing().map((r) =>
      r.check_key === 'token-permissions' ? ev('token-permissions', { status: 'FAIL', claim: 'mint retained' }) : r,
    );
    const evaluation = evaluateGatesAt(facts, new Date('2026-09-01T00:00:00Z'));
    expect(evaluation.aggregate).toBe('FAIL');
    expect(aggregateGates(evaluation.results)).toBe('FAIL');
  });

  it('ignores facts observed after asOf', () => {
    const early = passing()
      .filter((r) => r.check_key !== 'tradability')
      .map((r) =>
        ev(r.check_key, {
          effective_at: '2026-08-01T00:00:00Z',
          observed_at: '2026-08-01T00:00:00Z',
          ingested_at: '2026-08-01T00:00:00Z',
        }),
      );
    const late = ev('tradability', {
      effective_at: '2026-08-20T00:00:00Z',
      observed_at: '2026-08-20T00:00:00Z',
      ingested_at: '2026-08-20T00:00:00Z',
    });
    const evaluation = evaluateGatesAt([...early, late], new Date('2026-08-10T00:00:00Z'));
    expect(evaluation.results.find((r) => r.check_key === 'tradability')?.status).toBe('UNKNOWN');
    expect(scoringAllowed(evaluation)).toBe(false);
  });
});

describe('toGateRecordsAsOf — mint/freeze collapse', () => {
  it('FAIL on either authority even if the sibling is missing', () => {
    const onlyMint = NEURAL_CHECKS.filter((c) => c.id === 'n-mint-1');
    const records = toGateRecordsAsOf(onlyMint, at('2026-08-16T00:00:00Z'), 'proj-neural');
    expect(records.find((r) => r.check_key === 'token-permissions')?.status).toBe('FAIL');
  });

  it('UNKNOWN when mint is PASS but freeze has not been observed', () => {
    const mintPass = NEURAL_CHECKS.filter((c) => c.id === 'n-mint-2');
    const records = toGateRecordsAsOf(mintPass, at('2026-08-19T00:00:00Z'), 'proj-neural');
    expect(records.find((r) => r.check_key === 'token-permissions')?.status).toBe('UNKNOWN');
  });
});

describe('synthetic Neural Swarm timeline', () => {
  it('08-16: authorities and concentration FAIL; trade/program unseen', () => {
    const ev = evaluateChecksAt(NEURAL_CHECKS, at('2026-08-16T23:00:00Z'), 'proj-neural');
    expect(gateOf(NEURAL_CHECKS, '2026-08-16T23:00:00Z', 'proj-neural', 'token-permissions')?.status).toBe('FAIL');
    expect(gateOf(NEURAL_CHECKS, '2026-08-16T23:00:00Z', 'proj-neural', 'liquidity')?.status).toBe('FAIL');
    expect(gateOf(NEURAL_CHECKS, '2026-08-16T23:00:00Z', 'proj-neural', 'concentration')?.status).toBe('FAIL');
    expect(gateOf(NEURAL_CHECKS, '2026-08-16T23:00:00Z', 'proj-neural', 'tradability')?.status).toBe('UNKNOWN');
    expect(ev.aggregate).toBe('FAIL');
    expect(scoringAllowed(ev)).toBe(false);
  });

  it('does not see 08-18 revocation when replaying 08-16', () => {
    const records = toGateRecordsAsOf(NEURAL_CHECKS, at('2026-08-16T23:00:00Z'), 'proj-neural');
    expect(records.find((r) => r.check_key === 'token-permissions')?.claim).toContain('mint-authority:FAIL');
  });

  it('08-25: six PASS and scoring allowed', () => {
    const ev = evaluateChecksAt(NEURAL_CHECKS, at('2026-08-25T12:00:00Z'), 'proj-neural');
    expect(ev.results.every((r) => r.status === 'PASS')).toBe(true);
    expect(scoringAllowed(ev)).toBe(true);
  });
});

describe('anti-substitution and blocked fixtures', () => {
  it('holder PASS cannot substitute related-wallets FAIL', () => {
    const ev = evaluateChecksAt(LLM_LAB_CHECKS, at('2026-09-01T00:00:00Z'), 'proj-llm-lab');
    expect(ev.results.find((r) => r.check_key === 'concentration')?.status).toBe('PASS');
    expect(ev.results.find((r) => r.check_key === 'related-wallets')?.status).toBe('FAIL');
    expect(scoringAllowed(ev)).toBe(false);
  });

  it('honeypot stays FAIL on token, trade, liquidity, wallets', () => {
    const ev = evaluateChecksAt(HONEYPOT_CHECKS, at('2026-09-01T00:00:00Z'), 'proj-honeypot');
    expect(ev.aggregate).toBe('FAIL');
    expect(ev.results.find((r) => r.check_key === 'tradability')?.status).toBe('FAIL');
  });

  it('rocket has live mint and unproven LP lock', () => {
    const ev = evaluateChecksAt(ROCKET_CHECKS, at('2026-09-01T00:00:00Z'), 'proj-rocket');
    expect(ev.results.find((r) => r.check_key === 'token-permissions')?.status).toBe('FAIL');
    expect(ev.results.find((r) => r.check_key === 'liquidity')?.status).toBe('UNKNOWN');
    expect(scoringAllowed(ev)).toBe(false);
  });
});

describe('compat — PRD aliases are display only', () => {
  it('maps each kebab gate to the PRD name without introducing a second type', () => {
    expect(Object.keys(PRD_GATE_ALIAS).sort()).toEqual([...gateKeys].sort());
    expect(PRD_GATE_ALIAS['token-permissions']).toBe('TOKEN_PERMISSIONS');
    expect(PRD_GATE_ALIAS.tradability).toBe('BUY_SELL_SIMULATION');
    expect(PRD_GATE_ALIAS.liquidity).toBe('LIQUIDITY_EXIT');
    expect(PRD_GATE_ALIAS.concentration).toBe('HOLDER_CONCENTRATION');
    expect(PRD_GATE_ALIAS['related-wallets']).toBe('ASSOCIATED_WALLETS');
    expect(PRD_GATE_ALIAS['program-verification']).toBe('PROGRAM_VERIFICATION');
  });
});
