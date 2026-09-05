/**
 * M1 Chain Observation contract. Upstream of the M0 Evidence Contract:
 * M1 emits Observations ("chain showed mintAuthority = null at slot N"),
 * never Truth ("token-permissions PASS") and never Gate/Score/Decision writes.
 * Kinds are constrained to the M0 evidence fact types so observations can
 * later flow through assertEvidence — but M1 itself stops at observation.
 */
import type { EvidenceFactType } from '@/lib/evidence/contract';

export const OBSERVATION_VERSION = 'star-observation@1';

/** Live / capture / replay all run the SAME pipeline; mode is recorded, never branched on. */
export type ObservationMode = 'live' | 'replay';

/** Raw input envelope from a source (fixture today; registry-gated real sources later). */
export interface ObservationEnvelope {
  sourceId: string;
  slot: number;
  signature: string | null;
  instructionIndex: number | null;
  /** Observed-at must be ISO UTC when present; sources without clocks may omit. */
  observedAt: string | null;
  /** Source-declared observation kind hint; validated against the whitelist. */
  kind: string;
  raw: Record<string, unknown>;
}

/** Fully processed observation (the only success output of the pipeline). */
export interface Observation {
  observationKey: string;
  sourceId: string;
  mode: ObservationMode;
  slot: number;
  signature: string | null;
  instructionIndex: number | null;
  kind: EvidenceFactType;
  rawHash: string;
  rawPayload: Record<string, unknown>;
  normalized: Record<string, unknown>;
  observedAt: string;
}

export type PipelineStage = 'decode' | 'interpret' | 'normalize';

export class ObservationRejection extends Error {
  constructor(
    readonly stage: PipelineStage,
    readonly envelope: ObservationEnvelope,
    readonly reason: string,
  ) {
    super(`observation ${stage}: ${reason}`);
  }
}

/** Stable idempotency key: same chain fact arriving twice collapses to one row. */
export function observationKey(e: { sourceId: string; slot: number; signature: string | null; instructionIndex: number | null; kind: string }): string {
  return [e.sourceId, e.slot, e.signature ?? 'none', e.instructionIndex ?? 0, e.kind].join('|');
}

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

/** Decode stage: structural validation of the envelope itself. */
export function decode(e: ObservationEnvelope): ObservationEnvelope {
  if (!e.sourceId) throw new ObservationRejection('decode', e, 'sourceId required');
  if (!Number.isInteger(e.slot) || e.slot < 0) throw new ObservationRejection('decode', e, `slot must be a non-negative integer, got ${e.slot}`);
  if (!e.kind) throw new ObservationRejection('decode', e, 'kind required');
  if (!e.raw || typeof e.raw !== 'object' || Array.isArray(e.raw)) throw new ObservationRejection('decode', e, 'raw payload must be an object');
  if (e.observedAt != null && !ISO_UTC.test(e.observedAt)) throw new ObservationRejection('decode', e, `observedAt must be ISO UTC, got ${e.observedAt}`);
  return e;
}
