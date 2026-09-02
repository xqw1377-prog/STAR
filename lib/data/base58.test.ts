import { describe, it, expect } from 'vitest';
import { b58encode, b58decode } from './base58';

const BONK = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';

describe('base58', () => {
  it('encodes leading zero bytes as 1s', () => {
    expect(b58encode(new Uint8Array([0]))).toBe('1');
    expect(b58encode(new Uint8Array([0, 0, 1]))).toMatch(/^11/);
  });
  it('round-trips a real pubkey', () => {
    const bytes = b58decode(BONK);
    expect(bytes).toHaveLength(32);
    expect(b58encode(bytes)).toBe(BONK);
  });
  it('round-trips arbitrary bytes', () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 250, 251, 252, 0, 255]);
    expect(b58decode(b58encode(bytes))).toEqual(bytes);
  });
  it('throws on invalid characters', () => {
    expect(() => b58decode('0OIl')).toThrow(/invalid base58/);
  });
});
