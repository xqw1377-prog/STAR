import { drizzle } from 'drizzle-orm/pglite';
import { access, mkdir, constants, readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { createRequire } from 'module';
import * as schema from './schema';
import { ensureCoreAndD1 } from './apply-sql';

/**
 * PGlite must run as a real node module — bundling it breaks its wasm/sqlite
 * asset resolution (webpack rewrites new URL(..., import.meta.url) into a
 * WHATWG polyfill URL that Node fs rejects). Load it by absolute path at
 * runtime via createRequire, which no bundler can statically rewrite.
 */
function loadPglite(): typeof import('@electric-sql/pglite').PGlite {
  const pkgPath = join(process.cwd(), 'node_modules', '@electric-sql', 'pglite');
  // Use createRequire so this works in both CommonJS and ESM contexts without eval.
  return createRequire(import.meta.url)(pkgPath).PGlite;
}

const DATA_DIR = resolve(process.env.PGLITE_DATA_DIR || './.pglite');

let ready: Promise<any> | null = null;
let pgliteHandle: unknown = null;

/**
 * Filesystem PGlite store for server routes / tests. Schema is applied from
 * public/init.sql (the same DDL the browser idb store uses), sidestepping
 * the drizzle migrator whose journal reader breaks under Next's bundler.
 */
async function assertDataDirWritable(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await access(DATA_DIR, constants.W_OK);
}

async function build() {
  await assertDataDirWritable();
  const PGlite = loadPglite();
  const pglite = new PGlite(DATA_DIR);
  pgliteHandle = pglite;
  await pglite.waitReady;
  await ensureCoreAndD1(pglite, (name) => readFile(join(process.cwd(), 'public', name), 'utf8'));
  return drizzle(pglite, { schema });
}

/** Underlying PGlite handle (same instance as getDb) — for raw SQL probes in tests. */
export async function getPglite() {
  await getDb();
  return pgliteHandle as import('@electric-sql/pglite').PGlite;
}

export async function getDb() {
  if (!ready) ready = build();
  return ready;
}
