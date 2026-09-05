/**
 * M2/M3/M4 boundary acceptance. These capability organs are PURE computation:
 *  - no database imports at all (no schema, no drizzle, no getDb)
 *  - no decision/exit/strategy/radar/execution/engine imports
 *  - no UI route touches them (no runtime wiring until real sensors are governed)
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
const ORGANS = ['lib/actor', 'lib/tokenrisk', 'lib/eventintel'];

const FORBIDDEN = [
  /@\/db\/schema/,
  /@\/db\/client/,
  /drizzle-orm/,
  /@\/lib\/db/,
  /@\/lib\/alpha\/decision/,
  /@\/lib\/alpha\/exit/,
  /@\/lib\/alpha\/strategy/,
  /@\/lib\/alpha\/radar/,
  /@\/lib\/alpha\/execution/,
  /@\/lib\/engine/,
  /@\/lib\/star-engine/,
  /@\/lib\/queries/,
];

describe('M2/M3/M4 boundary — pure evidence organs', () => {
  it('actor/tokenrisk/eventintel import no database and no decision surface', () => {
    const hits: string[] = [];
    for (const organ of ORGANS) {
      for (const file of walk(join(ROOT, organ))) {
        if (file.includes('.test.')) continue; // production modules only
        const text = readFileSync(file, 'utf8');
        for (const re of FORBIDDEN) {
          if (re.test(text)) hits.push(`${file.replace(ROOT + '/', '')} matches ${re}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it('no app/UI route references the capability organs (no runtime wiring yet)', () => {
    const hits: string[] = [];
    for (const file of walk(join(ROOT, 'app'))) {
      const rel = file.replace(ROOT + '/', '');
      if (rel.includes('.test.')) continue;
      const text = readFileSync(file, 'utf8');
      if (/@\/lib\/(actor|tokenrisk|eventintel)/.test(text)) hits.push(`${rel} wires a capability organ into UI`);
    }
    expect(hits).toEqual([]);
  });
});
