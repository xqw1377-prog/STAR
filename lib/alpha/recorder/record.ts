import type { StarDb } from '@/lib/db';
import { classifyCollectError, completeFailure, completeObservation, ensurePlanItem, startAttempt } from '@/lib/data/ledger';
import { COLLECTOR_VERSION, UNIVERSE_POLICY_ID } from './version';
import type { NewPoolBirth, RecordOutcome } from './types';

const KIND = 'new-pool-birth';

function projectIdFor(mint: string): string {
  return `rec-${mint.slice(0, 24)}`;
}

/**
 * Append-only new-pool observation. Always writes Start before the body.
 * Failures become outcomes; they are never dropped.
 */
export async function recordNewPoolBirth(db: StarDb, birth: NewPoolBirth): Promise<RecordOutcome> {
  const projectId = projectIdFor(birth.mint);
  const planItemId = await ensurePlanItem(db, {
    sourceId: birth.source,
    methodId: KIND,
    projectId,
    factKind: KIND,
  });
  const started = await startAttempt(db, {
    projectId,
    factKind: KIND,
    sourceId: birth.source,
    methodId: KIND,
    planItemId,
    observationKey: `${birth.source}|${KIND}|${birth.mint}|${birth.poolAddress}|${COLLECTOR_VERSION}`,
    requestParams: {
      mint: birth.mint,
      dex: birth.dex,
      collector_version: COLLECTOR_VERSION,
      universe_policy_id: UNIVERSE_POLICY_ID,
    },
  });

  try {
    if (birth.initialReserveSolEq < 0) {
      throw new Error('invalid reserve');
    }
    await completeObservation(db, {
      attemptId: started.attemptId,
      observationKey: started.observationKey,
      projectId,
      kind: KIND,
      observedAt: new Date(birth.observedAt),
      slot: birth.slot,
      source: birth.source,
      payload: {
        mint: birth.mint,
        dex: birth.dex,
        quoteAsset: birth.quoteAsset,
        poolAddress: birth.poolAddress,
        initialReserveSolEq: birth.initialReserveSolEq,
        effectiveAt: birth.effectiveAt,
        collector_version: COLLECTOR_VERSION,
        universe_policy_id: UNIVERSE_POLICY_ID,
        raw_receipt: birth.rawReceipt,
      },
    });
    return {
      mint: birth.mint,
      attemptId: started.attemptId,
      ok: true,
      outcome: 'SUCCESS',
      detail: 'recorded',
      collectorVersion: COLLECTOR_VERSION,
    };
  } catch (error) {
    await completeFailure(db, { attemptId: started.attemptId, error });
    const classified = classifyCollectError(error);
    return {
      mint: birth.mint,
      attemptId: started.attemptId,
      ok: false,
      outcome: classified.outcome,
      detail: classified.errorCode,
      collectorVersion: COLLECTOR_VERSION,
    };
  }
}
