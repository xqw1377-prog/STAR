/**
 * M1 boundary acceptance: the observation layer produces observations only.
 * fs-enforced invariants:
 *  1. lib/observation never imports decision/exit/strategy/radar/execution
 *     or the research engines — it cannot decide anything.
 *  2. Nothing outside lib/observation writes the m1_* write surface
 *     (except db/schema.ts definitions and public/*.sql DDL).
 *  3. No app/UI route references the observation layer (M1 is infrastructure).
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'coverage') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, acc);
    else if (/\.(ts|tsx)$/.test(name)) acc.push(path);
  }
  return acc;
}

const ROOT = join(__dirname, '../..');
const M1_DIR = __dirname;

const FORBIDDEN_IN_M1 = [
  /@\/lib\/alpha\/decision/,
  /@\/lib\/alpha\/exit/,
  /@\/lib\/alpha\/strategy/,
  /@\/lib\/alpha\/radar/,
  /@\/lib\/alpha\/execution/,
  /@\/lib\/engine/,
  /@\/lib\/star-engine/,
  /@\/lib\/queries/,
];

describe('M1 boundary — observe only, never decide', () => {
  it('observation modules do not import decision/exit/strategy/radar/execution or engines', () => {
    const hits: string[] = [];
    for (const file of walk(M1_DIR)) {
      const text = readFileSync(file, 'utf8');
      for (const re of FORBIDDEN_IN_M1) {
        if (re.test(text)) hits.push(`${file.replace(ROOT + '/', '')} matches ${re}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('nothing outside lib/observation writes the m1 tables', () => {
    const hits: string[] = [];
    const files = [...walk(join(ROOT, 'lib')), ...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'db'))];
    for (const file of files) {
      const rel = file.replace(ROOT + '/', '');
      if (rel.startsWith('lib/observation/')) continue;
      if (rel === 'db/schema.ts') continue;
      if (rel.includes('.test.')) continue; // production modules only; audits/tests may consume
      const text = readFileSync(file, 'utf8');
      if (/INSERT\s+INTO\s+m1_/i.test(text)) hits.push(`${rel} raw-inserts into m1 tables`);
      if (/s\.m1(Observations|Checkpoint|Gaps|DeadLetters|Batches)/.test(text)) hits.push(`${rel} references m1 drizzle tables`);
    }
    expect(hits).toEqual([]);
  });
});
