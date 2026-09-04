import type { StarDb } from '@/lib/db';
import { assertSourceEnabled } from '@/lib/data/source-registry';
import { coverageAgainstIndependent } from './coverage';
import { FIXTURE_INDEPENDENT_INDEX, FIXTURE_NEW_POOLS, FIXTURE_POOL_BOOKS } from './fixture-universe';
import { recordNewPoolBirth, recordPoolBook } from './record';
import type { CoverageReport, NewPoolBirth, RecordOutcome } from './types';

export function listFixtureBirths(): NewPoolBirth[] {
  return FIXTURE_NEW_POOLS;
}

export function listIndependentIndex(): string[] {
  return FIXTURE_INDEPENDENT_INDEX;
}

/**
 * M1-BUILD discovery. Fixture path is the only enabled source.
 * solana-rpc remains BLOCKED.
 */
export async function recordFixtureUniverse(db: StarDb): Promise<RecordOutcome[]> {
  assertSourceEnabled('synthetic-fixtures');
  const out: RecordOutcome[] = [];
  for (const birth of listFixtureBirths()) {
    out.push(await recordNewPoolBirth(db, birth));
  }
  return out;
}

export async function recordFixtureBooks(db: StarDb): Promise<RecordOutcome[]> {
  assertSourceEnabled('synthetic-fixtures');
  const out: RecordOutcome[] = [];
  for (const book of FIXTURE_POOL_BOOKS) {
    out.push(await recordPoolBook(db, book));
  }
  return out;
}

export function fixtureCoverage(recorderMints: string[]): CoverageReport {
  return coverageAgainstIndependent(recorderMints, listIndependentIndex());
}
