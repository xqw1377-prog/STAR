import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const REQUIRED = [
  'T01', 'T02', 'T03a', 'T03b', 'T04', 'T05', 'T06', 'T06b',
  'T07', 'T07a', 'T08', 'T09', 'T10', 'T11', 'T12', 'T13', 'T14',
  'T15', 'T16', 'T17', 'T18', 'T19', 'T20', 'T21', 'T22', 'T23',
  'T24', 'T25', 'T26', 'T27', 'T28', 'T29', 'T30',
  'R5-T01', 'R5-T02', 'R5-T03', 'R5-T04a', 'R5-T04b', 'R5-T05',
  'R5-T06', 'R5-T07', 'R5-T08', 'R5-T09', 'R5-T10', 'R5-T11',
  'R5-T12a', 'R5-T12b', 'R5-T13', 'R5-T14', 'R5-T15a', 'R5-T15b',
  'R5-T16', 'R5-T17', 'R5-T18', 'R5-T19', 'R5-T20',
];

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, acc);
    else if (/\.test\.ts$/.test(name) && name !== 'acceptance-map.test.ts') acc.push(path);
  }
  return acc;
}

describe('R5-T20 test-to-phase map', () => {
  it('every D0 acceptance ID appears in at least one test title or body', () => {
    const root = join(__dirname, '../..');
    const text = walk(root).map((f) => readFileSync(f, 'utf8')).join('\n');
    const missing = REQUIRED.filter((id) => !text.includes(id));
    expect(missing).toEqual([]);
  });
});
