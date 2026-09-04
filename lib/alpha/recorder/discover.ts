import type { StarDb } from '@/lib/db';
import { assertSourceEnabled } from '@/lib/data/source-registry';
import { FIXTURE_NEW_POOLS } from './fixture-universe';
import { recordNewPoolBirth } from './record';
import type { NewPoolBirth, RecordOutcome } from './types';

export function listFixtureBirths(): NewPoolBirth[] {
  return FIXTURE_NEW_POOLS;
}

/**
 * M1-BUILD discovery. Fixture path is the only enabled source.
 * solana-rpc remains BLOCKED — calling this with real logs must fail closed.
 */
export async function recordFixtureUniverse(db: StarDb): Promise<RecordOutcome[]> {
  assertSourceEnabled('synthetic-fixtures');
  const out: RecordOutcome[] = [];
  for (const birth of listFixtureBirths()) {
    out.push(await recordNewPoolBirth(db, birth));
  }
  return out;
}
