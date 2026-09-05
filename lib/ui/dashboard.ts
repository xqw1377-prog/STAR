const STALE_MS = 5000;

export type PresentRecord = {
  mint: string;
  side: 'BUY' | 'SELL';
  skip?: string;
  exitReason?: string;
  label?: string;
  fill?: { mode: string; label: string; filledNotionalUsdc: number; remainingNotionalUsdc: number } | null;
};

export type PresentSnapshot = {
  lastTickAt: string | null;
};

export function formatAmount(value: unknown): string {
  if (value === undefined || value === null) return '—';
  const n = Number(value);
  if (Number.isNaN(n)) return '—';
  if (Number.isInteger(n)) return n.toLocaleString('en-US');
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function formatUtc(value: unknown): string {
  const d = value instanceof Date ? value : new Date(typeof value === 'string' ? value : '');
  if (Number.isNaN(d.getTime())) return '未提供';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}

export function isAttentionRecord(record: Partial<PresentRecord>): boolean {
  if (record.skip) return true;
  if (record.label && record.label !== 'FILL_OK' && record.label !== 'HOLD') return true;
  return false;
}

export function recordPresentation(record: Partial<PresentRecord>) {
  if (record.skip) {
    return { label: '策略跳过', note: record.skip };
  }
  if (record.label === 'FILL_OK') {
    if (!record.fill) return { label: '成交标签 · 模式未提供' };
    if (record.fill.mode === 'BROADCAST') return { label: '成交标签 · 非广播证明' };
    if (record.fill.mode === 'DRY_RUN') return { label: '模拟记账' };
    return { label: `成交标签 · ${record.fill.mode}` };
  }
  if (record.label) {
    const map: Record<string, string> = {
      EXECUTION_FAILURE: '执行失败',
      BUY_FAIL: '买入失败',
      SELL_FAIL: '卖出失败',
      PARTIAL_FILL: '部分成交',
      NO_POINT_IN_TIME_BOOK: '无点时簿',
      EXIT_IMPOSSIBLE: '退出不可能',
    };
    return { label: map[record.label] ?? record.label, note: record.label };
  }
  if (record.exitReason) return { label: '已退出', note: record.exitReason };
  return { label: '结果未提供' };
}

export function snapshotPresentation(state: PresentSnapshot | null, error: string | null, now: number) {
  if (!state && !error) return { kind: 'loading' as const, message: '正在读取运行快照', retained: false, stale: false };
  if (!state && error) return { kind: 'error' as const, message: `读取失败：${error}`, retained: false, stale: false };
  const last = state && state.lastTickAt ? Date.parse(state.lastTickAt) : null;
  if (last === null || Number.isNaN(last)) {
    return { kind: 'unknown' as const, message: '循环时间未提供', retained: Boolean(error), stale: false };
  }
  const age = now - last;
  if (age < -STALE_MS) {
    return { kind: 'unknown' as const, message: '循环记录时间异常', retained: Boolean(error), stale: false };
  }
  const stale = age > STALE_MS;
  if (error) return { kind: 'retained' as const, message: '保留上次快照（本次读取失败）', retained: true, stale };
  if (stale) return { kind: 'stale' as const, message: '循环记录已过期', retained: false, stale: true };
  return { kind: 'received' as const, message: `数据时间 ${formatUtc(state?.lastTickAt ?? null)}`, retained: false, stale: false };
}

export function shortMint(mint: string, head = 6, tail = 4): string {
  if (mint.length <= head + tail + 3) return mint;
  return `${mint.slice(0, head)}…${mint.slice(-tail)}`;
}
