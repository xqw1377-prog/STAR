import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'docs') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, acc);
    else if (/\.(ts|tsx|js)$/.test(name)) acc.push(path);
  }
  return acc;
}

describe('CROSS-IMPORT star/ = ZERO', () => {
  it('star-web runtime and tests do not import star/', () => {
    const root = join(__dirname, '../..');
    const hits: string[] = [];
    for (const file of walk(root)) {
      const text = readFileSync(file, 'utf8');
      if (/from ['"][^'"]*\/star\/|from ['"]star\/|require\(['"][^'"]*\/star\//.test(text)) {
        hits.push(file.replace(root + '/', ''));
      }
    }
    expect(hits).toEqual([]);
  });
});
