/**
 * B1 boundary acceptance (B1-6). Two invariants, fs-enforced:
 * 1. B1 modules never import decision / exit / strategy / radar / execution
 *    or the research engines — B1 cannot produce signals or decisions.
 * 2. Nothing outside lib/alpha/b1 touches the B1 write surface (no imports of
 *    b1, no drizzle b1-table references, no raw b1 INSERT) except db/schema.ts
 *    (table definitions) and public/*.sql (DDL + append-only triggers).
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

const ROOT = join(__dirname, '../../..');
const B1_DIR = join(ROOT, 'lib/alpha/b1');

const FORBIDDEN_IN_B1 = [
  /@\/lib\/alpha\/decision/,
  /@\/lib\/alpha\/exit/,
  /@\/lib\/alpha\/strategy/,
  /@\/lib\/alpha\/radar/,
  /@\/lib\/alpha\/execution/,
  /@\/lib\/engine/,
  /@\/lib\/star-engine/,
  /@\/lib\/queries/,
];

describe('B1 boundary — record only, never decide', () => {
  it('B1 modules do not import decision/exit/strategy/radar/execution or engines', () => {
    const hits: string[] = [];
    for (const file of walk(B1_DIR)) {
      const text = readFileSync(file, 'utf8');
      for (const re of FORBIDDEN_IN_B1) {
        if (re.test(text)) hits.push(`${file.replace(ROOT + '/', '')} matches ${re}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('nothing outside lib/alpha/b1 imports b1 or writes the b1 tables', () => {
    const hits: string[] = [];
    const files = [
      ...walk(join(ROOT, 'lib')),
      ...walk(join(ROOT, 'app')),
      ...walk(join(ROOT, 'db')),
    ];
    for (const file of files) {
      const rel = file.replace(ROOT + '/', '');
      if (rel.startsWith('lib/alpha/b1/')) continue;
      if (rel === 'db/schema.ts') continue;
      const text = readFileSync(file, 'utf8');
      if (/@\/lib\/alpha\/b1/.test(text)) hits.push(`${rel} imports b1`);
      if (/s\.b1(Events|Narratives|EventNarrativeLinks|NarrativeAssets|Anchors)/.test(text)) hits.push(`${rel} references b1 drizzle tables`);
      if (/INSERT\s+INTO\s+b1_/i.test(text)) hits.push(`${rel} raw-inserts into b1 tables`);
    }
    expect(hits).toEqual([]);
  });
});
