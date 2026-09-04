/** Frozen X-01 split. Embargo days do not enter official scores. */

export const EXPERIMENT_POLICY_ID = 'experiment-policy@v0-rev1' as const;

export const EXPERIMENT_SPLIT = {
  id: EXPERIMENT_POLICY_ID,
  train: 0.6,
  validation: 0.2,
  sealed: 0.2,
  embargoDays: 14,
} as const;

export type ExperimentBucket = 'TRAIN' | 'VALIDATION' | 'EMBARGO' | 'SEALED';

export function assignMintBucket(indexFromOldest: number, universeSize: number): ExperimentBucket {
  if (universeSize <= 0) throw new Error('empty universe');
  const q = (indexFromOldest + 0.5) / universeSize;
  if (q <= EXPERIMENT_SPLIT.train) return 'TRAIN';
  if (q <= EXPERIMENT_SPLIT.train + EXPERIMENT_SPLIT.validation) return 'VALIDATION';
  return 'SEALED';
}
