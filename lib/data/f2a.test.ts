/**
 * F2-A Contract Change lock tests (solana-readonly@3 → @4, principal-approved
 * 2026-09-05). These pin the nine mandated proofs so the change cannot be
 * silently regressed:
 *  1. executable is not part of @4
 *  2. parsers never generate executable
 *  3. interpretSell never consumes executable
 *  4. tradability = UNKNOWN while E-01 interpretation is unauthorized
 *  5. priceImpactPct survives as a raw fact
 *  6. 0.05 has no governance standing anywhere in the adapter path
 *  7. no 0.15 / 0.80 rules were smuggled in (that is F2-B, gated)
 *  8. gates@3 (RULE_VERSION) unchanged
 *  9. commitment did NOT enter the contract (that is F4, locked)
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { CONTRACT_VERSION, type SellSimulationPayload } from '@/lib/data/contract';
import { parseBuyQuote, parseJupiterQuote } from '@/lib/data/parsers';
import { interpretCheck } from '@/lib/domain';
import { RULE_VERSION } from '@/lib/domain/thresholds';

const ROOT = join(__dirname, '../..');
const PARSERS = readFileSync(join(ROOT, 'lib/data/parsers.ts'), 'utf8');
const CONTRACT = readFileSync(join(ROOT, 'lib/data/contract.ts'), 'utf8');
const INTERPRET = readFileSync(join(ROOT, 'lib/domain/interpret.ts'), 'utf8');

describe('F2-A lock: adapter has no verdict authority', () => {
  it('1. contract is @4 and the payload type carries no executable field', () => {
    expect(CONTRACT_VERSION).toBe('solana-readonly@4');
    const sample: SellSimulationPayload = {
      method: 'fixture',
      inputAmount: '1',
      outAmount: '1',
      priceImpactPct: 0.01,
      buy: { outAmount: '1', priceImpactPct: 0.01 },
      detail: 'x',
    };
    expect(sample).not.toHaveProperty('executable');
    expect(sample.buy).not.toHaveProperty('executable');
    expect(CONTRACT).not.toContain('sell.executable required');
  });

  it('2. parsers never generate executable', () => {
    const payload = parseJupiterQuote({ outAmount: '900', priceImpactPct: '0.012' }, '1000');
    expect(JSON.stringify(payload)).not.toContain('executable');
    const buy = parseBuyQuote({ outAmount: '990', priceImpactPct: '0.014' });
    expect(JSON.stringify(buy)).not.toContain('executable');
    expect(PARSERS).not.toContain('SELL_MAX_PRICE_IMPACT_PCT');
  });

  it('3+4. interpretSell bridges to E-01 (gates@4 F2-B); no adapter verdict consumption', () => {
    expect(INTERPRET.match(/interpretSell[\s\S]*?\n}/)?.[0]).not.toContain('p.executable');
    // Legacy payloads without e01Status → UNKNOWN (fail-closed for legacy)
    expect(interpretCheck('sell-simulation', { priceImpactPct: 0.001, buy: { priceImpactPct: 0.001 } }).status).toBe('UNKNOWN');
    expect(interpretCheck('sell-simulation', { priceImpactPct: 0.9, buy: { priceImpactPct: 0.9 } }).status).toBe('UNKNOWN');
    expect(interpretCheck('sell-simulation', {}).status).toBe('UNKNOWN');
    // E-01 bridged payloads produce governed states
    expect(interpretCheck('sell-simulation', { e01Status: 'PASS', e01Reason: 'N≥intended' }).status).toBe('PASS');
    expect(interpretCheck('sell-simulation', { e01Status: 'PARTIAL', e01Reason: 'partial' }).status).toBe('PARTIAL');
  });

  it('5. priceImpactPct survives as a raw fact', () => {
    expect(parseJupiterQuote({ outAmount: '900', priceImpactPct: '0.012' }, '1000').priceImpactPct).toBe(0.012);
  });

  it('6+7. no 5% standing; E-01 thresholds live in governed thresholds.ts (gates@4)', () => {
    expect(PARSERS).not.toContain('0.05');
    expect(INTERPRET).not.toContain('0.05');
    // 0.15/0.80 now authorized in thresholds.ts per E-01 FROZEN-v1 + gates@4 GCP
    const thresholds = readFileSync(join(ROOT, 'lib/domain/thresholds.ts'), 'utf8');
    expect(thresholds).toContain('IMPACT_MAX_PCT: 0.15');
    expect(thresholds).toContain('PRICING_LEG_MIN_RATIO: 0.80');
    // Adapter still has no thresholds
    expect(PARSERS).not.toContain('0.15');
    expect(PARSERS).not.toContain('0.80');
  });

  it('8. gates@4 rule version (upgraded from gates@3 per GCP, F2-B authorized)', () => {
    expect(RULE_VERSION).toBe('gates@4');
    expect(RULE_VERSION).not.toBe('gates@3');
  });

  it('9. commitment did NOT enter the contract (F4 locked)', () => {
    expect(CONTRACT).not.toContain('commitment');
    expect(CONTRACT).not.toContain('requestedCommitment');
  });
});
