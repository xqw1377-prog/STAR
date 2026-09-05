import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { readFile } from 'fs/promises';
import { SCHEMA_LABEL, TARGET_SCHEMA_VERSION, ensureCoreAndD1 } from '@/db/apply-sql';

describe('star_schema_version', () => {
  it('applies once and stays at target on a second boot', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'star-schema-'));
    const { PGlite } = await import('@electric-sql/pglite');
    const db = new PGlite(dir);
    await db.waitReady;
    const readSql = (name: 'init.sql' | 'init-d1.sql' | 'init-d1b.sql' | 'init-d1c.sql' | 'init-d1d.sql' | 'init-d1-triggers.sql' | 'init-b1.sql') =>
      readFile(join(process.cwd(), 'public', name), 'utf8');
    await ensureCoreAndD1(db, readSql);
    await ensureCoreAndD1(db, readSql);
    const once = await db.query('SELECT version, label FROM star_schema_version WHERE id = 1') as {
      rows: { version: number; label: string }[];
    };
    expect(Number(once.rows[0].version)).toBe(TARGET_SCHEMA_VERSION);
    expect(once.rows[0].label).toBe(SCHEMA_LABEL);
    const count = await db.query('SELECT count(*)::int AS n FROM star_schema_version') as { rows: { n: number }[] };
    expect(Number(count.rows[0].n)).toBe(1);
  });

  it('keeps every drizzle table name in public/*.sql or the version DDL', () => {
    const schemaSrc = readFileSync(join(process.cwd(), 'db/schema.ts'), 'utf8');
    const tables = [...schemaSrc.matchAll(/pgTable\('([^']+)'/g)].map((m) => m[1]);
    const sql = [
      'init.sql', 'init-d1.sql', 'init-d1b.sql', 'init-d1c.sql', 'init-d1d.sql', 'init-b1.sql',
    ].map((name) => readFileSync(join(process.cwd(), 'public', name), 'utf8')).join('\n')
      + '\nCREATE TABLE star_schema_version';
    const missing = tables.filter((name) => !sql.includes(`"${name}"`) && !sql.includes(`TABLE ${name}`) && !sql.includes(`TABLE "${name}"`));
    expect(missing).toEqual([]);
  });
});
