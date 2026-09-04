/**
 * Unique temporal engine (D4). Gate, Audit, Replay, and Collect call only this file.
 */
import { checkKeys, gateKeys, type CheckKey, type Evidence, type GateKey } from './types';

export class TemporalViolation extends Error {}

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const SKEW_MS = 1000;

export function isIsoUtc(value: string): boolean {
  return ISO_RE.test(value);
}

export function quarantineReason(observedAt: Date, ingestedAt: Date, effectiveAt: Date): string | null {
  if (observedAt.getTime() > ingestedAt.getTime() + SKEW_MS) {
    return `observedAt ${observedAt.toISOString()} after ingestedAt ${ingestedAt.toISOString()}`;
  }
  if (effectiveAt.getTime() > ingestedAt.getTime() + SKEW_MS) return 'effectiveAt after ingestedAt';
  return null;
}

export function validateIsoUtc(value: string, field: string): void {
  if (!ISO_RE.test(value)) throw new TemporalViolation(`${field} not ISO-UTC`);
}

export function assertKnownCheck(check: string): asserts check is CheckKey {
  if (!(checkKeys as readonly string[]).includes(check)) {
    throw new TemporalViolation(`unknown check key ${check}`);
  }
}

export function assertKnownGate(gate: string): asserts gate is GateKey {
  if (!(gateKeys as readonly string[]).includes(gate)) {
    throw new TemporalViolation(`unknown gate key ${gate}`);
  }
}

export interface Timed {
  id: string;
  observedAt: string;
  ingestedAt: string;
}

export function latestByKey<T>(
  rows: T[],
  cutoff: string,
  observedAt: (row: T) => string,
  ingestedAt: (row: T) => string,
  id: (row: T) => string,
  key: (row: T) => string,
  effectiveAt?: (row: T) => string,
): Map<string, T> {
  const available = rows
    .filter((row) => observedAt(row) <= cutoff && (!effectiveAt || effectiveAt(row) <= cutoff))
    .sort((a, b) => {
      const byObserved = observedAt(b).localeCompare(observedAt(a));
      return byObserved || ingestedAt(b).localeCompare(ingestedAt(a)) || id(b).localeCompare(id(a));
    });
  const latest = new Map<string, T>();
  for (const item of available) {
    const k = key(item);
    if (!latest.has(k)) latest.set(k, item);
  }
  return latest;
}

export function evidenceAvailableAt(item: Evidence, cutoff: string) {
  return item.observedAt <= cutoff && item.effectiveAt <= cutoff;
}

export function evidenceAtCutoff(evidence: Evidence[], cutoff: string) {
  return evidence
    .filter((item) => evidenceAvailableAt(item, cutoff))
    .sort((a, b) => {
      const observed = b.observedAt.localeCompare(a.observedAt);
      return observed || b.ingestedAt.localeCompare(a.ingestedAt) || b.id.localeCompare(a.id);
    });
}

export function latestEvidenceByCheck(evidence: Evidence[], cutoff: string) {
  return latestByKey(
    evidence,
    cutoff,
    (row) => row.observedAt,
    (row) => row.ingestedAt,
    (row) => row.id,
    (row) => row.checkKey,
    (row) => row.effectiveAt,
  ) as Map<CheckKey, Evidence>;
}
