export { COLLECTOR_VERSION, UNIVERSE_POLICY_ID } from './version';
export { recordNewPoolBirth, recordPoolBook } from './record';
export { listFixtureBirths, listIndependentIndex, recordFixtureUniverse, recordFixtureBooks, fixtureCoverage } from './discover';
export { coverageAgainstIndependent } from './coverage';
export { latencyFromLedger } from './latency';
export { FIXTURE_NEW_POOLS, FIXTURE_INDEPENDENT_INDEX, FIXTURE_POOL_BOOKS } from './fixture-universe';
export type { NewPoolBirth, PoolBookSnapshot, RecordOutcome, CoverageReport, LatencyReport, SupportedDex, QuoteAsset } from './types';
