import { describe, expect, it } from 'vitest';
import { formatAmount, formatUtc, isAttentionRecord, recordPresentation, snapshotPresentation } from './dashboard';

describe('dashboard display boundaries', () => {
  it('does not replace missing numbers or dates with zero or now', () => {
    expect(formatAmount(undefined)).toBe('—');
    expect(formatAmount(null)).toBe('—');
    expect(formatAmount(Number.NaN)).toBe('—');
    expect(formatAmount(0)).toBe('0');
    expect(formatAmount(100000)).toBe('100,000');
    expect(formatUtc(null)).toBe('未提供');
    expect(formatUtc('invalid')).toBe('未提供');
    expect(formatUtc('2026-09-05T00:00:00.000Z')).toBe('2026-09-05 00:00:00 UTC');
  });

  it('separates initial loading, failed reads, retained snapshots and old loop records', () => {
    const now = Date.parse('2026-09-05T00:00:20Z');
    expect(snapshotPresentation(null, null, now).kind).toBe('loading');
    expect(snapshotPresentation(null, 'HTTP 403', now).kind).toBe('error');
    expect(snapshotPresentation({ lastTickAt: null }, null, now).kind).toBe('unknown');
    expect(snapshotPresentation({ lastTickAt: '2026-09-05T00:00:19Z' }, null, now).kind).toBe('received');
    expect(snapshotPresentation({ lastTickAt: '2026-09-05T00:00:00Z' }, null, now).kind).toBe('stale');
    expect(snapshotPresentation({ lastTickAt: '2026-09-05T00:00:19Z' }, 'HTTP 503', now).kind).toBe('retained');
    expect(snapshotPresentation({ lastTickAt: '2026-09-05T00:00:30Z' }, null, now).kind).toBe('unknown');
  });

  it('keeps skips, failures and partial fills visible without manufacturing verdicts', () => {
    expect(isAttentionRecord({ mint: 'a', side: 'BUY', skip: 'NO_BOOK' })).toBe(true);
    expect(isAttentionRecord({ mint: 'a', side: 'BUY', label: 'EXECUTION_FAILURE' })).toBe(true);
    expect(isAttentionRecord({ mint: 'a', side: 'SELL', label: 'SELL_FAIL' })).toBe(true);
    expect(isAttentionRecord({ mint: 'a', side: 'SELL', label: 'EXIT_IMPOSSIBLE' })).toBe(true);
    expect(isAttentionRecord({ mint: 'a', side: 'BUY', label: 'PARTIAL_FILL' })).toBe(true);
    expect(isAttentionRecord({ mint: 'a', side: 'BUY', label: 'FILL_OK' })).toBe(false);
    expect(recordPresentation({ mint: 'a', side: 'BUY' }).label).toBe('结果未提供');
    expect(recordPresentation({ mint: 'a', side: 'BUY', skip: 'NEW_REASON' }).label).toBe('策略跳过');
  });

  it('does not interpret FILL_OK as live execution or market truth', () => {
    const fill = { mode: 'DRY_RUN' as const, label: 'FILL_OK' as const, filledNotionalUsdc: 500, remainingNotionalUsdc: 0 };
    const record = { mint: 'a', side: 'BUY' as const, label: 'FILL_OK' as const, fill };
    expect(recordPresentation(record).label).toBe('模拟记账');
    expect(recordPresentation({ ...record, fill: undefined }).label).toBe('成交标签 · 模式未提供');
    expect(recordPresentation({ ...record, fill: { ...fill, mode: 'BROADCAST' } }).label).toBe('成交标签 · 非广播证明');
  });
});
