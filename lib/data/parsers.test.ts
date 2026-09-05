import { describe, it, expect } from 'vitest';
import {
  holderFactSlot,
  parseBuyQuote,
  parseDexScreener,
  parseHolderAccounts,
  parseJupiterQuote,
  parseMintAccount,
  parseProgramAccounts,
  standardSellSize,
} from './parsers';
import { b58decode, b58encode } from './base58';

describe('parseMintAccount', () => {
  it('maps jsonParsed mint info onto the contract payload', () => {
    // G1-B F1: with no owner passed, an absent extensions field is NOT
    // proof of "none" — it stays null (UNKNOWN downstream).
    const payload = parseMintAccount({ decimals: 5, supply: '76', mintAuthority: 'SomeAuthority1111111111111111111111111111', freezeAuthority: null });
    expect(payload).toEqual({
      decimals: 5,
      supply: '76',
      mintAuthority: 'SomeAuthority1111111111111111111111111111',
      freezeAuthority: null,
      transferHook: null,
      permanentDelegate: null,
      feeConfig: null,
      token2022Extensions: null,
    });
  });
  it('extracts Token-2022 transfer hook from extensions', () => {
    const payload = parseMintAccount({
      decimals: 6,
      supply: '1',
      mintAuthority: null,
      freezeAuthority: null,
      extensions: [{ extension: 'transferHook', state: { programId: 'Hook11111111111111111111111111111111111111' } }],
    });
    expect(payload?.transferHook).toBe('Hook11111111111111111111111111111111111111');
    expect(payload?.token2022Extensions).toEqual(['transferHook']);
  });
  it('returns null for non-mint accounts', () => {
    expect(parseMintAccount(null)).toBeNull();
    expect(parseMintAccount('garbage')).toBeNull();
  });
});

describe('parseHolderAccounts', () => {
  const largest = [
    { address: 'AddrOne1111111111111111111111111111111', amount: '400' },
    { address: 'AddrTwo11111111111111111111111111111111', amount: '100' },
  ];
  it('computes top10 share against total supply', () => {
    const payload = parseHolderAccounts(largest, { supply: '1000' })!;
    expect(payload.top10Pct).toBeCloseTo(0.5);
    expect(payload.top10PctEntityAdjusted).toBeNull();
    expect(payload.topAccounts[0].pctOfSupply).toBeCloseTo(0.4);
  });
  it('returns null when supply is zero or missing', () => {
    expect(parseHolderAccounts(largest, { supply: '0' })).toBeNull();
    expect(parseHolderAccounts(null, { supply: '10' })).toBeNull();
  });
});

describe('parseProgramAccounts', () => {
  it('extracts programdata key and empty authority option → immutable', () => {
    const programDataKey = b58encode(new Uint8Array(32).fill(7));
    const progData = Buffer.alloc(4 + 8 + 4); // enum + slot + empty option
    progData.writeUInt32LE(0, 12);
    const program = { data: [Buffer.concat([Buffer.from([32, 0, 0, 0]), b58decode(programDataKey)]).toString('base64'), 'base64'] as [string, string] };
    const programData = { data: [progData.toString('base64'), 'base64'] as [string, string] };
    const payload = parseProgramAccounts('ProgId111111111111111111111111111111111', program, programData);
    expect(payload.immutable).toBe(true);
    expect(payload.upgradeAuthority).toBeNull();
  });
  it('extracts a live upgrade authority', () => {
    const authority = b58encode(new Uint8Array(32).fill(9));
    const programDataBytes = Buffer.alloc(4 + 8 + 4 + 32);
    programDataBytes.writeUInt32LE(1, 12);
    programDataBytes.set(b58decode(authority), 16);
    const programDataKey = b58encode(new Uint8Array(32).fill(7));
    const program = { data: [Buffer.concat([Buffer.from([32, 0, 0, 0]), b58decode(programDataKey)]).toString('base64'), 'base64'] as [string, string] };
    const programData = { data: [programDataBytes.toString('base64'), 'base64'] as [string, string] };
    const payload = parseProgramAccounts('ProgId111111111111111111111111111111111', program, programData);
    expect(payload.immutable).toBe(false);
    expect(payload.upgradeAuthority).toBe(authority);
  });
  it('refuses to call a short/malformed account immutable', () => {
    const short = { data: [Buffer.from([1, 2, 3]).toString('base64'), 'base64'] as [string, string] };
    const payload = parseProgramAccounts('ProgId111111111111111111111111111111111', short, null);
    expect(payload.accountParsed).toBe(false);
    expect(payload.immutable).toBe(false);
  });
});

describe('parseDexScreener', () => {
  it('aggregates relevant pair TVL and marks LP burn unproven', () => {
    const json = {
      pairs: [
        { dexId: 'raydium', pairAddress: 'P1', baseToken: { address: 'MINT', symbol: 'A' }, quoteToken: { address: 'SOL', symbol: 'WSOL' }, liquidity: { usd: 100000 } },
        { dexId: 'orca', pairAddress: 'P2', baseToken: { address: 'OTHER', symbol: 'B' }, quoteToken: { address: 'MINT', symbol: 'A' }, liquidity: { usd: 50000 } },
        { dexId: 'meteora', pairAddress: 'P3', baseToken: { address: 'X', symbol: 'X' }, quoteToken: { address: 'Y', symbol: 'Y' }, liquidity: { usd: 999999 } },
      ],
    };
    const payload = parseDexScreener(json, 'MINT');
    expect(payload.pools).toHaveLength(2);
    expect(payload.tvlUsdTotal).toBe(150000);
    expect(payload.exitDepthUsd).toBeNull();
    expect(payload.pools[0].lpBurnedPct).toBeNull();
  });
  it('returns null TVL when no pairs relate to the mint', () => {
    const payload = parseDexScreener({ pairs: [] }, 'MINT');
    expect(payload.tvlUsdTotal).toBeNull();
  });
});

describe('parseJupiterQuote + parseBuyQuote (GATE-002 legs)', () => {
  it('marks a bounded-impact sell route executable, buy leg separate', () => {
    const payload = parseJupiterQuote({ outAmount: '500', priceImpactPct: '0.01' }, '1000');
    expect(payload.executable).toBe(true);
    expect(payload.buy).toBeNull();
    const buy = parseBuyQuote({ outAmount: '990', priceImpactPct: '0.02' });
    expect(buy!.executable).toBe(true);
    expect(buy!.outAmount).toBe('990');
  });
  it('blocks outsized impact on either leg', () => {
    expect(parseJupiterQuote({ outAmount: '500', priceImpactPct: '0.4' }, '1000').executable).toBe(false);
    expect(parseBuyQuote({ outAmount: '990', priceImpactPct: '0.4' })!.executable).toBe(false);
  });
  it('missing routes fail closed', () => {
    expect(parseJupiterQuote(null, '1000').executable).toBe(false);
    expect(parseBuyQuote(null)).toBeNull();
  });
});

describe('standardSellSize', () => {
  it('is 0.01% of supply', () => {
    expect(standardSellSize('1000000')).toBe('100');
  });
  it('is 0 for zero supply', () => {
    expect(standardSellSize('0')).toBe('0');
  });
});

// ── G1-B remediation acceptance (F1/F3/F5, principal-approved 2026-09-05) ──

describe('G1-B F1: extensions missing must not collapse to []', () => {
  const V1 = 'TokenkegQfeZyiNwAJbNbGKPBXCWu2f9kRxMmNei2';
  const T22 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnB97CXngPv1Gk';
  const base = { decimals: 6, supply: '1000', mintAuthority: null, freezeAuthority: null };

  it('field absent + no owner → null (UNKNOWN downstream, never PASS)', () => {
    const payload = parseMintAccount({ ...base }, null)!;
    expect(payload.token2022Extensions).toBeNull();
  });

  it('field absent + Token-2022 owner → null (absence is not proof of none)', () => {
    const payload = parseMintAccount({ ...base }, T22)!;
    expect(payload.token2022Extensions).toBeNull();
  });

  it('field absent + SPL Token v1 owner → [] (protocol fact: v1 has no extensions)', () => {
    const payload = parseMintAccount({ ...base }, V1)!;
    expect(payload.token2022Extensions).toEqual([]);
  });

  it('field positively reported → names (regardless of owner)', () => {
    const payload = parseMintAccount({ ...base, extensions: [{ extension: 'transferHook' }] }, T22)!;
    expect(payload.token2022Extensions).toEqual(['transferHook']);
  });
});

describe('G1-B F5: structurally missing mint fields reject the whole fact', () => {
  it('missing decimals → null (no ?? 0 default)', () => {
    expect(parseMintAccount({ supply: '1000' })).toBeNull();
  });
  it('missing supply → null (no ?? \'0\' default)', () => {
    expect(parseMintAccount({ decimals: 6 })).toBeNull();
  });
  it('provider-given zero is preserved as zero (0 given ≠ 0 defaulted)', () => {
    const payload = parseMintAccount({ decimals: 6, supply: '0' })!;
    expect(payload.supply).toBe('0');
  });
});

describe('G1-B F3: fact slot comes from the response context, never a separate clock', () => {
  it('largest.context.slot wins', () => {
    expect(holderFactSlot({ context: { slot: 120 } }, { context: { slot: 119 } })).toBe(120);
  });
  it('falls back to supply context.slot', () => {
    expect(holderFactSlot({ context: {} }, { context: { slot: 119 } })).toBe(119);
  });
  it('both absent → null (missing stays missing)', () => {
    expect(holderFactSlot({}, {})).toBeNull();
  });
});
