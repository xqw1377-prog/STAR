import { latestByKey } from './temporal';
import { CHECK_TO_GATE, GATE_CHECKS, gateKeys, type GateKey, type GateStatus } from './types';

export interface CheckObservation {
  id: string;
  project_id: string;
  check: string;
  status: GateStatus;
  claim: string;
  source: string;
  source_kind: string;
  effective_at: string;
  observed_at: string;
  ingested_at: string;
  confidence: number;
}

export interface GateRecord {
  id: string;
  project_id: string;
  check_key: GateKey;
  status: GateStatus;
  claim: string;
  source: string;
  effective_at: string;
  observed_at: string;
  ingested_at: string;
  confidence: number;
}

export interface GateResult {
  check_key: GateKey;
  status: GateStatus;
  claim: string;
  evidence_id: string | null;
}

export interface GateEvaluation {
  as_of: string;
  results: GateResult[];
  aggregate: GateStatus;
}

const TOKEN_CHECKS = ['mint-authority', 'freeze-authority', 'token-authority'] as const;

function combineStatus(statuses: GateStatus[]): GateStatus {
  if (statuses.some((s) => s === 'FAIL')) return 'FAIL';
  if (statuses.some((s) => s === 'UNKNOWN')) return 'UNKNOWN';
  return statuses.length && statuses.every((s) => s === 'PASS') ? 'PASS' : 'UNKNOWN';
}

function latestPerCheck(rows: CheckObservation[], cutoff: string): Map<string, CheckObservation> {
  return latestByKey(
    rows,
    cutoff,
    (row) => row.observed_at,
    (row) => row.ingested_at,
    (row) => row.id,
    (row) => row.check,
  );
}

function toRecord(gate: GateKey, parts: CheckObservation[], projectId: string): GateRecord {
  const status = combineStatus(parts.map((p) => p.status));
  const newest = [...parts].sort((a, b) => b.observed_at.localeCompare(a.observed_at))[0];
  return {
    id: parts.map((p) => p.id).join('+') || `missing-${gate}`,
    project_id: projectId,
    check_key: gate,
    status,
    claim: parts.map((p) => `${p.check}:${p.status} ${p.claim}`).join(' | '),
    source: newest.source,
    effective_at: newest.effective_at,
    observed_at: newest.observed_at,
    ingested_at: newest.ingested_at,
    confidence: Math.min(...parts.map((p) => p.confidence)),
  };
}

/**
 * Collapse check-level observations into one record per kebab gate as of `asOf`.
 * Mint + freeze both feed token-permissions; a missing sibling is UNKNOWN unless the present check FAILs.
 */
export function toGateRecordsAsOf(checks: CheckObservation[], asOf: Date, projectId: string): GateRecord[] {
  const latest = latestPerCheck(checks, asOf.toISOString());
  const out: GateRecord[] = [];

  const mint = latest.get('mint-authority');
  const freeze = latest.get('freeze-authority');
  const precombined = latest.get('token-authority');
  if (mint || freeze) {
    const parts = [mint, freeze].filter((x): x is CheckObservation => Boolean(x));
    out.push({
      ...toRecord('token-permissions', parts, projectId),
      status: combineStatus([mint?.status ?? 'UNKNOWN', freeze?.status ?? 'UNKNOWN']),
    });
  } else if (precombined) {
    out.push(toRecord('token-permissions', [precombined], projectId));
  }

  for (const [check, gate] of Object.entries(CHECK_TO_GATE)) {
    if (TOKEN_CHECKS.includes(check as (typeof TOKEN_CHECKS)[number])) continue;
    const row = latest.get(check);
    if (row) out.push(toRecord(gate, [row], projectId));
  }

  return out;
}

export function evaluateGatesAt(records: GateRecord[], asOf: Date): GateEvaluation {
  const latest = latestByKey(
    records,
    asOf.toISOString(),
    (row) => row.observed_at,
    (row) => row.ingested_at,
    (row) => row.id,
    (row) => row.check_key,
  );
  const results: GateResult[] = gateKeys.map((check_key) => {
    const row = latest.get(check_key);
    if (!row) {
      return {
        check_key,
        status: 'UNKNOWN',
        claim: `No ${check_key} evidence observed at or before asOf`,
        evidence_id: null,
      };
    }
    return { check_key, status: row.status, claim: row.claim, evidence_id: row.id };
  });
  return { as_of: asOf.toISOString(), results, aggregate: aggregateGates(results) };
}

export function aggregateGates(results: GateResult[]): GateStatus {
  if (results.some((r) => r.status === 'FAIL')) return 'FAIL';
  if (results.some((r) => r.status === 'UNKNOWN')) return 'UNKNOWN';
  if (results.length === gateKeys.length && results.every((r) => r.status === 'PASS')) return 'PASS';
  return 'UNKNOWN';
}

export function scoringAllowed(evaluation: GateEvaluation): boolean {
  return evaluation.aggregate === 'PASS';
}

export function evaluateChecksAt(checks: CheckObservation[], asOf: Date, projectId: string): GateEvaluation {
  return evaluateGatesAt(toGateRecordsAsOf(checks, asOf, projectId), asOf);
}

export { GATE_CHECKS };
