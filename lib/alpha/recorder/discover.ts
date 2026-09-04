import type { StarDb } from '@/lib/db';
import { FIXTURE_NEW_POOLS } from './fixture-universe';
import { recordNewPoolBirth, type BirthRecord } from './record';
import type { NewPoolBirth } from './types';

export function listFixtureBirths(): Array<Omit<NewPoolBirth, 'receiptId'>> {
  return FIXTURE_NEW_POOLS;
}

/**
 * M1-BUILD discovery. Fixture path is the only enabled source.
 * recordNewPoolBirth fail-closes any non-ENABLED source onto the ledger.
 */
export async function recordFixtureUniverse(db: StarDb): Promise<BirthRecord[]> {
  const out: BirthRecord[] = [];
  for (const birth of listFixtureBirths()) {
    out.push(await recordNewPoolBirth(db, birth));
  }
  return out;
}
