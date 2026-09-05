export const TARGET_SCHEMA_VERSION = 6;
export const SCHEMA_LABEL = 'star-raw@6';

const VERSION_DDL = `
CREATE TABLE IF NOT EXISTS star_schema_version (
  id integer PRIMARY KEY,
  version integer NOT NULL,
  label text NOT NULL,
  applied_at timestamptz NOT NULL
);
`;

export function stripSqlComments(sql: string): string {
  return sql
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      return !/^-->\s*statement-breakpoint\s*$/.test(trimmed) && !/^-->/.test(trimmed);
    })
    .join('\n');
}

type SqlName = 'init.sql' | 'init-d1.sql' | 'init-d1b.sql' | 'init-d1c.sql' | 'init-d1d.sql' | 'init-d1-triggers.sql' | 'init-b1.sql' | 'init-m1.sql';

type PgliteLike = {
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
  exec: (sql: string) => Promise<unknown>;
};

async function tableReady(pglite: PgliteLike, sql: string): Promise<boolean> {
  try {
    await pglite.query(sql);
    return true;
  } catch {
    return false;
  }
}

async function readVersion(pglite: PgliteLike): Promise<number> {
  try {
    const result = await pglite.query('SELECT version FROM star_schema_version WHERE id = 1') as { rows?: { version: number }[] };
    const version = result.rows?.[0]?.version;
    return typeof version === 'number' ? version : Number(version ?? 0);
  } catch {
    return 0;
  }
}

async function writeVersion(pglite: PgliteLike, version: number): Promise<void> {
  // 参数化写入，避免字符串插值拼接进 SQL（L2：SCHEMA_LABEL/version 不再内联）。
  await pglite.query(
    `INSERT INTO star_schema_version (id, version, label, applied_at)
     VALUES (1, $1, $2, now())
     ON CONFLICT (id) DO UPDATE SET
       version = EXCLUDED.version,
       label = EXCLUDED.label,
       applied_at = EXCLUDED.applied_at;`,
    [version, SCHEMA_LABEL],
  );
}

/**
 * Apply public/*.sql in order. Patches after the recorded version are skipped.
 * init-d1d / triggers run once when promoting to v4, not on every boot.
 */
export async function ensureCoreAndD1(
  pglite: PgliteLike,
  readSql: (name: SqlName) => Promise<string>,
): Promise<void> {
  await pglite.exec(VERSION_DDL);
  let version = await readVersion(pglite);

  if (version < 1 && !(await tableReady(pglite, 'SELECT 1 FROM projects LIMIT 1'))) {
    await pglite.exec(stripSqlComments(await readSql('init.sql')));
    version = 1;
    await writeVersion(pglite, version);
  }
  if (version < 2 && !(await tableReady(pglite, 'SELECT 1 FROM collection_attempt LIMIT 1'))) {
    await pglite.exec(stripSqlComments(await readSql('init-d1.sql')));
    version = 2;
    await writeVersion(pglite, version);
  }
  if (version < 3 && !(await tableReady(pglite, 'SELECT 1 FROM receipt_relation LIMIT 1'))) {
    await pglite.exec(stripSqlComments(await readSql('init-d1b.sql')));
    version = 3;
    await writeVersion(pglite, version);
  }
  if (!(await tableReady(pglite, 'SELECT 1 FROM interpretation_context LIMIT 1'))) {
    await pglite.exec(stripSqlComments(await readSql('init-d1c.sql')));
  }
  if (version < 4) {
    await pglite.exec(stripSqlComments(await readSql('init-d1d.sql')));
    await pglite.exec(stripSqlComments(await readSql('init-d1-triggers.sql')));
    version = 4;
    await writeVersion(pglite, version);
  }
  if (version < 5) {
    // B1 Narrative Event Log (CONSENSUS-OPERATING-MODEL FROZEN-rev1). Append-only.
    await pglite.exec(stripSqlComments(await readSql('init-b1.sql')));
    version = 5;
    await writeVersion(pglite, version);
  }
  if (version < 6) {
    // M1 Chain Observation (EXTERNAL-CAPABILITY-MATRIX V1). Observations only.
    await pglite.exec(stripSqlComments(await readSql('init-m1.sql')));
    version = 6;
    await writeVersion(pglite, version);
  }
}
