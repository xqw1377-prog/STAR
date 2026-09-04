import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { CORPUS_PARTITION, CORPUS_REAL, CORPUS_SEED, CORPUS_SYNTHETIC, corpusStats, generateCorpus } from './generate';
import { oracleEvaluateCase } from './oracle';
import { engineEvaluate } from './engine-eval';
import { GATE_NAMES } from './types';

function stable(value: unknown): string {
  return JSON.stringify(value);
}

describe('D1-C synthetic corpus', () => {
  const cases = generateCorpus(CORPUS_SEED);

  it('T08: same seed reproduces the corpus byte-for-byte', () => {
    const again = generateCorpus(CORPUS_SEED);
    expect(JSON.stringify(again)).toBe(JSON.stringify(cases));
  });

  it('T10: coverage matrix and cohort constraints', () => {
    const stats = corpusStats(cases);
    expect(stats.synthetic).toBe(CORPUS_SYNTHETIC);
    expect(stats.real).toBe(0);
    expect(CORPUS_REAL).toBe(0);
    expect(stats.success).toBe(50);
    expect(stats.fail).toBe(100);
    for (const g of GATE_NAMES) {
      expect(stats.cover[g].PASS, g).toBeGreaterThanOrEqual(3);
      expect(stats.cover[g].FAIL, g).toBeGreaterThanOrEqual(3);
      expect(stats.cover[g].UNKNOWN, g).toBeGreaterThanOrEqual(3);
    }
    expect(stats.successAllPass).toBeGreaterThanOrEqual(10);
    expect(stats.failPartial).toBeGreaterThanOrEqual(30);
  });

  it('T17: oracle and generator do not import production interpret/gates/engine', () => {
    const files = ['oracle.ts', 'generate.ts', 'payloads.ts', 'types.ts'].map((name) =>
      readFileSync(join(__dirname, name), 'utf8'),
    );
    for (const src of files) {
      expect(src).not.toMatch(/interpretCheck/);
      expect(src).not.toMatch(/aggregateGates/);
      expect(src).not.toMatch(/\bTHRESHOLDS\b/);
      expect(src).not.toMatch(/from ['"]@\/lib\/domain\/(interpret|gates|thresholds)/);
      expect(src).not.toMatch(/from ['"]@\/lib\/engine/);
      expect(src).not.toMatch(/from ['"]@\/lib\/star-engine/);
      expect(src).not.toMatch(/from ['"]@\/lib\/domain['"]/);
    }
  });

  it('T18: a family is never split across partitions', () => {
    const families = new Set(cases.map((c) => c.family_id));
    for (const family of families) {
      expect(CORPUS_PARTITION[family], family).toMatch(/calibration|validation/);
    }
    const seen = new Map<string, string>();
    for (const c of cases) {
      const part = CORPUS_PARTITION[c.family_id];
      if (!seen.has(c.family_id)) seen.set(c.family_id, part);
      expect(seen.get(c.family_id)).toBe(part);
    }
  });

  it('T07: each of 150 cases matches the independent oracle and the engine', () => {
    for (const c of cases) {
      const ora = oracleEvaluateCase(c);
      const eng = engineEvaluate(c);
      expect(ora, c.sample_id).toEqual(c.expected);
      expect(eng.gates, c.sample_id).toEqual(c.expected.gates);
      expect(eng.readiness, c.sample_id).toBe(c.expected.readiness);
      expect(eng.score_total, c.sample_id).toBe(c.expected.score_total);
    }
  });

  it('T07a: hindsight add/remove/modify does not change cutoff output', () => {
    for (const c of cases) {
      const base = engineEvaluate(c, c.facts);
      const added = engineEvaluate(c, [...c.facts, ...c.hindsight]);
      const modified = engineEvaluate(c, [
        ...c.facts,
        ...c.hindsight.map((h) => ({ ...h, payload: { ...(h.payload as object), mutated: true } })),
      ]);
      expect(stable(added), `${c.sample_id} add`).toBe(stable(base));
      expect(stable(modified), `${c.sample_id} modify`).toBe(stable(base));
    }
  });

  it('T09: moving a hindsight fact before cutoff changes at least one case', () => {
    const target = cases.find((c) => c.family_id === 'F-ALL-PASS');
    expect(target).toBeTruthy();
    const base = engineEvaluate(target!);
    const beforeCutoff = new Date(Date.parse(target!.decision_cutoff) - 3600000).toISOString();
    const moved = engineEvaluate(target!, [
      ...target!.facts,
      ...target!.hindsight.map((h) => ({
        ...h,
        observedAt: beforeCutoff,
        effectiveAt: beforeCutoff,
        ingestedAt: new Date(Date.parse(beforeCutoff) + 1000).toISOString(),
      })),
    ]);
    expect(stable(moved)).not.toBe(stable(base));
  });
});
