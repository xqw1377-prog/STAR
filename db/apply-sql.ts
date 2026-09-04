export function stripSqlComments(sql: string): string {
  return sql
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      return !/^-->\s*statement-breakpoint\s*$/.test(trimmed) && !/^-->/.test(trimmed);
    })
    .join('\n');
}

export async function ensureCoreAndD1(
  pglite: { query: (sql: string) => Promise<unknown>; exec: (sql: string) => Promise<unknown> },
  readSql: (name: 'init.sql' | 'init-d1.sql' | 'init-d1b.sql' | 'init-d1c.sql' | 'init-d1d.sql' | 'init-d1-triggers.sql') => Promise<string>,
): Promise<void> {
  try {
    await pglite.query('SELECT 1 FROM projects LIMIT 1');
  } catch {
    await pglite.exec(stripSqlComments(await readSql('init.sql')));
  }
  try {
    await pglite.query('SELECT 1 FROM collection_attempt LIMIT 1');
  } catch {
    await pglite.exec(stripSqlComments(await readSql('init-d1.sql')));
  }
  try {
    await pglite.query('SELECT 1 FROM receipt_relation LIMIT 1');
  } catch {
    await pglite.exec(stripSqlComments(await readSql('init-d1b.sql')));
  }
  try {
    await pglite.query('SELECT 1 FROM interpretation_context LIMIT 1');
  } catch {
    await pglite.exec(stripSqlComments(await readSql('init-d1c.sql')));
  }
  await pglite.exec(stripSqlComments(await readSql('init-d1d.sql')));
  // Immutable-boundary triggers: append-only enforcement at the DB layer.
  // The trigger SQL is self-idempotent (DROP IF EXISTS + CREATE), so exec unconditionally.
  await pglite.exec(stripSqlComments(await readSql('init-d1-triggers.sql')));
}
