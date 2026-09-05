/**
 * M3 acceptance — token/program raw inspection (rugcheck-skill, grade A).
 *  - byte-level SPL decode correctness (authorities, decimals, supply)
 *  - Token-2022 TLV presence scan (known codes named; unknowns flagged)
 *  - ProgramData upgrade-authority decode
 *  - evidence maps to token-permissions / program-verification ONLY
 *  - raw facts carry no verdict — "PASS/FAIL" is a downstream STAR judgment
 */
import { describe, expect, it } from 'vitest';
import { gateEligibility } from '@/lib/evidence/contract';
import {
  buildTokenProgramEvidence,
  decodeMintAccount,
  decodeProgramData,
  fixtureMintBytes,
  fixtureProgramDataBytes,
  scanToken2022Extensions,
} from './inspection';

const AUTH = new Uint8Array(32).fill(7);

describe('M3 byte-level decode', () => {
  it('decodes a clean SPL mint: both authorities revoked', () => {
    const state = decodeMintAccount(fixtureMintBytes());
    expect(state.mintAuthority).toBeNull();
    expect(state.freezeAuthority).toBeNull();
    expect(state.decimals).toBe(6);
    expect(state.supply).toBe('1000000');
    expect(state.isInitialized).toBe(true);
    expect(state.extensions).toEqual([]);
  });

  it('decodes live authorities and scans Token-2022 extensions', () => {
    const bytes = fixtureMintBytes({
      mintAuthority: AUTH,
      extensions: [
        [7, new Uint8Array(32)], // PermanentDelegate
        [18, new Uint8Array(32)], // TransferHook
        [99, new Uint8Array(4)], // unknown code
      ],
    });
    const state = decodeMintAccount(bytes);
    expect(state.mintAuthority).toBeTruthy();
    expect(state.freezeAuthority).toBeNull();
    expect(state.extensions.map((e) => e.name)).toEqual(['PermanentDelegate', 'TransferHook', 'Unknown(99)']);
    expect(scanToken2022Extensions(bytes)).toHaveLength(3);
  });

  it('decodes ProgramData upgrade authority (set and revoked)', () => {
    expect(decodeProgramData(fixtureProgramDataBytes(AUTH)).upgradeAuthority).toBeTruthy();
    expect(decodeProgramData(fixtureProgramDataBytes(null)).upgradeAuthority).toBeNull();
  });

  it('rejects malformed accounts (too short)', () => {
    expect(() => decodeMintAccount(new Uint8Array(10))).toThrow(/too short/);
    expect(() => decodeProgramData(new Uint8Array(8))).toThrow(/too short/);
  });
});

describe('M3 evidence emission', () => {
  it('emits raw-state evidence mapped to token-permissions / program-verification only', async () => {
    const records = await buildTokenProgramEvidence({
      mint: 'PumpMint111111111111111111111111111111111',
      mintAccountBytes: fixtureMintBytes({ extensions: [[7, new Uint8Array(32)]] }),
      programDataBytes: fixtureProgramDataBytes(AUTH),
      programId: 'ProgID11111111111111111111111111111111111',
      observedAt: '2026-09-04T00:00:00.000Z',
      slot: 1200,
    });
    expect(records.map((r) => r.factType).sort()).toEqual([
      'freeze-authority-state', 'mint-authority-state', 'program-upgrade-authority', 'token-2022-extensions',
    ]);
    expect(gateEligibility('mint-authority-state')).toEqual(['token-permissions']);
    expect(gateEligibility('token-2022-extensions')).toEqual(['token-permissions']);
    expect(gateEligibility('program-upgrade-authority')).toEqual(['program-verification']);
    for (const r of records) {
      expect(JSON.stringify(r.value)).not.toMatch(/"PASS"|"FAIL"|risk|verdict/i);
    }
  });
});
