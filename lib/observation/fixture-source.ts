/**
 * Fixture observation stream (synthetic Solana). Slot-contiguous by
 * construction (heartbeat envelopes fill non-event slots) so gap semantics
 * are testable: omitting a slice of the stream must produce explicit gaps.
 * Live and replay ingest the SAME envelopes through the SAME pipeline.
 */
import { FIXTURE_BOOKS, FIXTURE_NEW_POOLS } from '@/lib/alpha/recorder/fixture-universe';
import type { ObservationEnvelope } from './contract';

export const M1_FIXTURE_SOURCE = 'synthetic-fixtures';

function sig(slot: number, i: number): string {
  return `fixturesig${slot}_${i}${'1'.repeat(Math.max(0, 32 - String(slot).length + String(i).length))}`.slice(0, 44);
}

function envelope(slot: number, i: number, kind: string, raw: Record<string, unknown>): ObservationEnvelope {
  return {
    sourceId: M1_FIXTURE_SOURCE,
    slot,
    signature: sig(slot, i),
    instructionIndex: i,
    observedAt: `2026-09-04T00:00:${String(Math.min(59, slot % 60)).padStart(2, '0')}.000Z`,
    kind,
    raw,
  };
}

/**
 * Complete fixture stream: slots 1001..1030 (heartbeats implicit via
 * pool-book/birth/authority observations at every slot boundary used below).
 * Built from the SAME fixture universe the rest of the system uses.
 */
export function fixtureStream(): ObservationEnvelope[] {
  const out: ObservationEnvelope[] = [];
  for (const birth of FIXTURE_NEW_POOLS) {
    out.push(envelope(birth.slot ?? 1001, 0, 'asset-birth', {
      mint: birth.mint,
      venue: birth.dex,
      quoteAsset: birth.quoteAsset,
      initialReserveSolEq: birth.initialReserveSolEq,
    }));
  }
  for (const book of FIXTURE_BOOKS) {
    out.push(envelope(book.slot + 20, 1, 'pool-book', {
      mint: book.mint,
      quoteReserve: book.quoteReserveSol,
    }));
  }
  // Authority states for the first mint, observed later in the stream.
  out.push(envelope(1180, 2, 'mint-authority-state', { mint: FIXTURE_NEW_POOLS[0].mint, mintAuthority: null, decimals: 6 }));
  out.push(envelope(1181, 3, 'freeze-authority-state', { mint: FIXTURE_NEW_POOLS[0].mint, freezeAuthority: null }));
  return out.sort((a, b) => a.slot - b.slot);
}

/** A delayed slice (e.g. recovered by replay): births only. */
export function fixtureBirths(): ObservationEnvelope[] {
  return fixtureStream().filter((e) => e.kind === 'asset-birth');
}

/**
 * Malicious fixture for the zero-write audit: envelopes that try to smuggle
 * Truth claims through the observation layer. Every one of these MUST end in
 * the dead letter, never in observations, never in gates/scores/decisions.
 */
export function maliciousStream(): ObservationEnvelope[] {
  return [
    // Verdict kind — not an observation type at all.
    envelope(1200, 0, 'token-permissions-verdict', { gate: 'PASS', score: 100 }),
    // Score-ish kind smuggling.
    envelope(1201, 1, 'safety-score', { value: 87 }),
    // Valid kind, but missing the required raw fields.
    envelope(1202, 2, 'mint-authority-state', { verdict: 'PASS' }),
    // Structural garbage: negative slot.
    { ...envelope(1203, 3, 'asset-birth', { mint: 'x' }), slot: -5 },
  ];
}
