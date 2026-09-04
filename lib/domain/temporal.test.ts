import { describe, it, expect } from 'vitest';
import { evidenceAvailableAt, evidenceAtCutoff, latestEvidenceByCheck, quarantineReason, TemporalViolation, validateIsoUtc } from './temporal';
import type { Evidence } from './types';

const ev = (partial: Partial<Evidence>): Evidence => ({
  id: '0',
  checkKey: 'liquidity',
  claim: '',
  source: 'fixture',
  sourceKind: 'SYNTHETIC',
  effectiveAt: '2026-08-15T00:00:00Z',
  observedAt: '2026-08-15T00:00:00Z',
  ingestedAt: '2026-08-15T01:00:00Z',
  confidence: 1,
  ...partial,
});

describe('evidenceAvailableAt (DATA-001 leak guard)', () => {
  it('hides evidence observed after the cutoff', () => {
    expect(evidenceAvailableAt(ev({ observedAt: '2026-08-20T00:00:00Z' }), '2026-08-19T00:00:00Z')).toBe(false);
    expect(evidenceAvailableAt(ev({ observedAt: '2026-08-19T00:00:00Z' }), '2026-08-19T00:00:00Z')).toBe(true);
  });

  it('hides evidence ingested after the cutoff even if observed earlier', () => {
    expect(evidenceAvailableAt(ev({
      observedAt: '2026-08-18T00:00:00Z',
      effectiveAt: '2026-08-18T00:00:00Z',
      ingestedAt: '2026-08-20T00:00:00Z',
    }), '2026-08-19T00:00:00Z')).toBe(false);
  });
});

describe('evidenceAtCutoff / latestEvidenceByCheck', () => {
  const rows = [
    ev({ id: '1', checkKey: 'liquidity', observedAt: '2026-08-16T00:00:00Z' }),
    ev({ id: '2', checkKey: 'liquidity', observedAt: '2026-08-20T00:00:00Z' }),
    ev({ id: '3', checkKey: 'mint-authority', observedAt: '2026-08-15T00:00:00Z' }),
  ];

  it('picks the latest observation per check as of the cutoff', () => {
    const latest = latestEvidenceByCheck(rows, '2026-09-01T00:00:00Z');
    expect(latest.get('liquidity')!.id).toBe('2');
    expect(latest.get('mint-authority')!.id).toBe('3');
  });

  it('does not see observations after the cutoff', () => {
    const latest = latestEvidenceByCheck(rows, '2026-08-17T00:00:00Z');
    expect(latest.get('liquidity')!.id).toBe('1');
  });

  it('is deterministic on equal timestamps (DATA-002): observedAt, then ingestedAt, then id', () => {
    const tied = [
      ev({ id: '4', observedAt: '2026-08-20T00:00:00Z', ingestedAt: '2026-08-20T02:00:00Z' }),
      ev({ id: '5', observedAt: '2026-08-20T00:00:00Z', ingestedAt: '2026-08-20T03:00:00Z' }),
      ev({ id: '6', observedAt: '2026-08-20T00:00:00Z', ingestedAt: '2026-08-20T03:00:00Z' }),
    ];
    const sorted = evidenceAtCutoff(tied, '2026-09-01T00:00:00Z');
    expect(sorted.map((r) => r.id)).toEqual(['6', '5', '4']);
    expect(latestEvidenceByCheck(tied, '2026-09-01T00:00:00Z').get('liquidity')!.id).toBe('6');
  });

  it('returns empty map when nothing is observable at the cutoff', () => {
    expect(latestEvidenceByCheck(rows, '2026-08-01T00:00:00Z').size).toBe(0);
  });
});

describe('quarantineReason / validateIsoUtc', () => {
  it('quarantines observedAt after ingestedAt', () => {
    const reason = quarantineReason(
      new Date('2026-09-01T00:00:00Z'),
      new Date('2026-08-01T00:00:00Z'),
      new Date('2026-09-01T00:00:00Z'),
    );
    expect(reason).toMatch(/after ingestedAt/);
  });

  it('rejects non-UTC ISO', () => {
    expect(() => validateIsoUtc('2026-09-02 00:00:00', 'observedAt')).toThrow(TemporalViolation);
  });
});
