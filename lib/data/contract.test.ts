import { describe, it, expect } from 'vitest';
import { assertFact, ContractViolation, CONTRACT_VERSION, FACT_KINDS, type ChainFact } from './contract';
import { checkKeys, CHECK_TO_GATE } from '@/lib/domain/types';

const mint = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';

function goodFact(overrides: Partial<ChainFact<'mint-authority'>> = {}): ChainFact<'mint-authority'> {
  return {
    kind: 'mint-authority',
    contractVersion: CONTRACT_VERSION,
    observedAt: '2026-09-02T00:00:00Z',
    slot: 300_000_001,
    source: 'solana-rpc:api.mainnet-beta.solana.com',
    sourceUrl: null,
    chainId: 'solana',
    mint,
    payload: {
      decimals: 5,
      supply: '1000000',
      mintAuthority: null,
      freezeAuthority: null,
      transferHook: null,
      permanentDelegate: null,
      feeConfig: null,
      token2022Extensions: [],
    },
    ...overrides,
  };
}

describe('assertFact', () => {
  it('accepts a contract-conforming fact', () => {
    expect(assertFact(goodFact())).toEqual(goodFact());
  });
  it('rejects wrong contract version', () => {
    expect(() => assertFact(goodFact({ contractVersion: 'solana-readonly@1' }))).toThrow(ContractViolation);
  });
  it('rejects non-UTC ISO observedAt', () => {
    expect(() => assertFact(goodFact({ observedAt: '2026-09-02 00:00:00' }))).toThrow(ContractViolation);
    expect(() => assertFact(goodFact({ observedAt: 'not a date' }))).toThrow(ContractViolation);
  });
  it('rejects unknown fact kind', () => {
    expect(() => assertFact(goodFact({ kind: 'vibes' as any }))).toThrow(ContractViolation);
  });
  it('rejects missing source', () => {
    expect(() => assertFact(goodFact({ source: '' }))).toThrow(ContractViolation);
  });
  it('rejects non-solana chainId', () => {
    expect(() => assertFact(goodFact({ chainId: 'ethereum' }))).toThrow(ContractViolation);
  });
  it('rejects malformed mint', () => {
    expect(() => assertFact(goodFact({ mint: '0x123' }))).toThrow(ContractViolation);
  });
  it('rejects missing payload', () => {
    expect(() => assertFact(goodFact({ payload: undefined as any }))).toThrow(ContractViolation);
  });
  it('rejects fractional slot', () => {
    expect(() => assertFact(goodFact({ slot: 1.5 }))).toThrow(ContractViolation);
  });
});

describe('DATA-005: every fact kind maps to exactly one gate', () => {
  it('contract FACT_KINDS and domain checkKeys are the same set', () => {
    expect([...FACT_KINDS].sort()).toEqual([...checkKeys].sort());
  });
  it('every check key has exactly one gate', () => {
    for (const key of checkKeys) {
      expect(CHECK_TO_GATE[key]).toBeTruthy();
    }
    expect(new Set(Object.values(CHECK_TO_GATE)).size).toBeGreaterThan(0);
  });
});
