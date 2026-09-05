/**
 * Interpret + normalize stages. The kind whitelist is the anti-injection
 * boundary: inputs claiming verdict/score kinds (e.g. a "gate-verdict"
 * envelope from a malicious fixture) are rejected to the dead letter —
 * M1 structurally cannot carry Truth claims.
 */
import { EVIDENCE_FACT_TYPES, type EvidenceFactType } from '@/lib/evidence/contract';
import { sha256hex } from '@/lib/data/hash';
import { ObservationRejection, observationKey, type Observation, type ObservationEnvelope, type ObservationMode } from './contract';
function interpret(e: ObservationEnvelope): EvidenceFactType {
  if (!(EVIDENCE_FACT_TYPES as readonly string[]).includes(e.kind)) {
    throw new ObservationRejection(
      'interpret',
      e,
      `kind '${e.kind}' is not a raw observation type (verdicts/scores are not observations; they are downstream STAR judgments)`,
    );
  }
  return e.kind as EvidenceFactType;
}

function normalize(e: ObservationEnvelope, kind: EvidenceFactType): Record<string, unknown> {
  // Normalized shape per kind family. Raw fields pass through — no judgment
  // is added, none is removed. Observations carry facts, not conclusions.
  const required: Record<string, string[]> = {
    'asset-birth': ['mint'],
    'pool-book': ['mint', 'quoteReserve'],
    'pool-state': ['mint', 'poolAddress', 'venue', 'feesResolved'],
    'mint-authority-state': ['mintAuthority'],
    'freeze-authority-state': ['freezeAuthority'],
    'token-2022-extensions': ['extensions'],
    'program-upgrade-authority': ['upgradeAuthority'],
    'holder-top-accounts': ['accounts'],
    'funding-transfer': ['from', 'to'],
    'funding-relation': ['parent', 'child'],
    'early-buyer': ['wallet', 'mint'],
    'fresh-wallet': ['wallet', 'txCount'],
    'coordinated-activity': ['wallets', 'behavior'],
    'external-event-candidate': ['label'],
  };
  const missing = (required[kind] ?? []).filter((field) => !(field in e.raw));
  if (missing.length) {
    throw new ObservationRejection('normalize', e, `raw payload missing required field(s): ${missing.join(', ')}`);
  }
  return { ...e.raw };
}

/** Decode → interpret → normalize for a single envelope. Throws ObservationRejection on any stage failure. */
export async function processEnvelope(e: ObservationEnvelope, mode: ObservationMode): Promise<Observation> {
  // decode was already applied by the pipeline; interpret guards the kind.
  const kind = interpret(e);
  const normalized = normalize(e, kind);
  const rawJson = JSON.stringify(e.raw);
  return {
    observationKey: observationKey(e),
    sourceId: e.sourceId,
    mode,
    slot: e.slot,
    signature: e.signature,
    instructionIndex: e.instructionIndex,
    kind,
    rawHash: await sha256hex(rawJson),
    rawPayload: e.raw,
    normalized,
    observedAt: e.observedAt ?? new Date().toISOString(),
  };
}
