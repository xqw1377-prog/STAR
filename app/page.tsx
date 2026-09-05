'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { QueryError } from '@/components/query-error';
import { SNIPE_V0 } from '@/lib/alpha/strategy/snipe-v0';

interface PoolSignal {
  event: { id: string; label: string; observedAt: string; attention: number };
  narrative: { id: string; label: string };
  assetId: string;
  market: string;
  launch: { venue: string; quote: string; initialReserve: number; reserveUnit: string; clock: number | null };
  book?: { quoteReserve: number; clock: number } | null;
  money: { earlyWallets: number | null; buyPressure: number | null; flowIn: boolean | null };
}

interface SnipeState {
  strategy: string;
  capability: string;
  mode: string;
  broadcast: boolean;
  tick: number;
  decisionSlot: number;
  lastTickAt: string | null;
  money: string;
  cashUsdc: number;
  navUsdc: number;
  open: Array<{ mint: string; entrySlot: number; notionalUsdc: number }>;
  trades: Array<{ mint: string; side: 'BUY' | 'SELL'; skip?: string; exitReason?: string; label?: string }>;
  pool: Array<{ signal: PoolSignal; verdict: { enter: boolean; reason?: string; notionalUsdc?: number } }>;
  exitTheses: Array<{ mint: string; reserveSol: number | null; exit: { action: string; kind: string; why: string[] } }>;
}

interface CapabilityState {
  id: string;
  runtime: { b1: { recorder: string; status: string; realSensor: boolean; decisionReachable: boolean } };
}

const short = (mint: string) => `${mint.slice(0, 6)}…${mint.slice(-4)}`;
const UNKNOWN = 'UNKNOWN';

function Bar({ ratio, tone }: { ratio: number; tone: 'ok' | 'warn' | 'info' }) {
  const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
  const color = tone === 'ok' ? 'bg-emerald-500' : tone === 'warn' ? 'bg-red-500' : 'bg-blue-500';
  return (
    <div className="h-1.5 w-full rounded bg-muted overflow-hidden">
      <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function RiskDot({ state }: { state: 'pass' | 'fail' | 'unknown' }) {
  const map = { pass: '✓', fail: '✗', unknown: '?' } as const;
  const cls = { pass: 'text-emerald-600', fail: 'text-red-600', unknown: 'text-muted-foreground' } as const;
  return <span className={`font-bold ${cls[state]}`}>{map[state]}</span>;
}

export default function SnipeDesk() {
  const [state, setState] = useState<SnipeState | null>(null);
  const [cap, setCap] = useState<CapabilityState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    fetch('/api/capability', { cache: 'no-store' })
      .then((r) => r.json())
      .then((body: CapabilityState) => { if (!cancelled) setCap(body); })
      .catch(() => undefined);
    const pull = () => {
      fetch('/api/snipe', { cache: 'no-store' })
        .then((r) => { if (!r.ok) throw new Error(`snipe ${r.status}`); return r.json(); })
        .then((body: SnipeState) => { if (!cancelled) { setError(null); setState(body); } })
        .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : '阻击循环失败'); });
    };
    pull();
    const id = window.setInterval(pull, 2000);
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { cancelled = true; window.clearInterval(id); window.clearInterval(clock); };
  }, []);

  const tickAgeMs = state?.lastTickAt ? now - Date.parse(state.lastTickAt) : null;
  const stale = tickAgeMs != null && tickAgeMs > 5000;

  const selection = useMemo(() => {
    if (!state) return null;
    const poolRow = state.pool.find((p) => p.signal.assetId === selected);
    if (poolRow) return { kind: 'candidate' as const, row: poolRow };
    const pos = state.open.find((p) => p.mint === selected);
    const thesis = state.exitTheses.find((t) => t.mint === selected);
    const poolFallback = state.pool.find((p) => p.signal.assetId)?.signal;
    const signalForPos = poolFallback?.assetId === selected ? poolFallback : null;
    if (pos) {
      return { kind: 'position' as const, position: pos, thesis: thesis?.exit, signal: signalForPos };
    }
    return null;
  }, [state, selected]);

  const defaultSelected = selected ?? state?.pool[0]?.signal.assetId ?? state?.open[0]?.mint ?? null;
  const view = selection ?? (state && defaultSelected
    ? (() => {
        const poolRow = state.pool.find((p) => p.signal.assetId === defaultSelected);
        if (poolRow) return { kind: 'candidate' as const, row: poolRow };
        const pos = state.open.find((p) => p.mint === defaultSelected);
        return pos
          ? { kind: 'position' as const, position: pos, thesis: state.exitTheses.find((t) => t.mint === defaultSelected)?.exit, signal: null }
          : null;
      })()
    : null);

  const fills = (state?.trades ?? []).filter((t) => !t.skip);
  const skips = (state?.trades ?? []).filter((t) => t.skip);

  return (
    <main className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">STAR 阻击台</h1>
          <p className="text-sm text-muted-foreground">
            市场雷达 → 阻击池 → 为什么选择它 → 打多少、何时退出 · 决策解释 + DRY_RUN
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline">U-01-SOLANA</Badge>
          <Badge variant={stale ? 'destructive' : 'secondary'}>{stale ? `循环 STALE ${Math.round((tickAgeMs ?? 0) / 1000)}s` : '循环 LIVE'}</Badge>
          <Badge variant="secondary">{state?.mode ?? 'DRY_RUN'}</Badge>
          {cap ? <Badge variant="outline">{cap.id} · B1 {cap.runtime.b1.status} · Sensor {cap.runtime.b1.realSensor ? 'ON' : 'OFF'}</Badge> : null}
        </div>
      </div>
      {error ? <QueryError message={error} /> : null}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">模拟账面余额</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{state ? state.navUsdc.toLocaleString('en-US') : '—'}</div>
            <div className="text-xs text-muted-foreground">现金 {state ? state.cashUsdc.toLocaleString('en-US') : '—'} USDC</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">策略</CardTitle></CardHeader>
          <CardContent>
            <div className="font-mono text-sm font-bold">{state?.strategy ?? SNIPE_V0.id}</div>
            <div className="text-xs text-muted-foreground">改规则 = 升版本</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">执行模式</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{state?.mode ?? 'DRY_RUN'}</div>
            <div className="text-xs text-muted-foreground">无广播 · 无钱包模块</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">持仓</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{state?.open.length ?? 0}</div>
            <div className="text-xs text-muted-foreground">上限 {SNIPE_V0.maxPositions} · 单名 0.5% NAV</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">循环</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{state?.tick ?? 0}</div>
            <div className="text-xs text-muted-foreground">slot {state?.decisionSlot ?? '—'} · {state?.lastTickAt ? new Date(state.lastTickAt).toLocaleTimeString('zh-CN') : '—'}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>市场雷达 <span className="text-xs font-normal text-muted-foreground">· 合成夹具宇宙 · 热度 ≠ 资金，交叉才有价值</span></CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2">热度排名 · 需 B3 社交传感器</div>
            <table className="w-full text-xs">
              <thead className="text-muted-foreground"><tr><th className="text-left">Token</th><th className="text-left">叙事</th><th className="text-right">事件关注度</th><th className="text-right">传播速度</th></tr></thead>
              <tbody>
                {(state?.pool ?? []).map(({ signal }) => (
                  <tr key={signal.assetId} className="border-t cursor-pointer" onClick={() => setSelected(signal.assetId)}>
                    <td className="py-1.5 font-mono">{short(signal.assetId)}</td>
                    <td>{signal.narrative.label}</td>
                    <td className="text-right">{signal.event.attention.toFixed(2)}</td>
                    <td className="text-right text-muted-foreground">{UNKNOWN}</td>
                  </tr>
                ))}
                {(state?.pool.length ?? 0) === 0 ? <tr><td colSpan={4} className="py-2 text-muted-foreground">当前无待判定候选（已全部入场或拒绝）</td></tr> : null}
              </tbody>
            </table>
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2">资金排名 · 链上储备</div>
            <table className="w-full text-xs">
              <thead className="text-muted-foreground"><tr><th className="text-left">Token</th><th className="text-right">初始储备</th><th className="text-right">当前储备</th><th className="text-right">净流入</th></tr></thead>
              <tbody>
                {(state?.pool ?? []).map(({ signal }) => (
                  <tr key={signal.assetId} className="border-t cursor-pointer" onClick={() => setSelected(signal.assetId)}>
                    <td className="py-1.5 font-mono">{short(signal.assetId)}</td>
                    <td className="text-right">{signal.launch.initialReserve} {signal.launch.reserveUnit}</td>
                    <td className="text-right">{signal.book ? `${signal.book.quoteReserve} SOL` : '—'}</td>
                    <td className="text-right text-muted-foreground">{UNKNOWN}</td>
                  </tr>
                ))}
                {(state?.pool.length ?? 0) === 0 ? <tr><td colSpan={4} className="py-2 text-muted-foreground">—</td></tr> : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-primary/40">
        <CardHeader>
          <CardTitle>★ 阻击池 <span className="text-xs font-normal text-muted-foreground">· STAR 现在准备阻击什么 · 事件级别 S/A/B/C 需 B3 传感器，当前 NOT-COMPUTABLE</span></CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr><th className="text-left">Token</th><th className="text-left">事件 → 叙事</th><th className="text-left">事件级别</th><th className="text-left">风险</th><th className="text-left">策略</th><th className="text-left">状态</th></tr>
            </thead>
            <tbody>
              {(state?.pool ?? []).map(({ signal, verdict }) => {
                const reserve = signal.book?.quoteReserve ?? null;
                const riskBits = [
                  reserve != null ? '流动✓' : '流动?',
                  reserve != null ? (reserve >= SNIPE_V0.exitReserveSolEq ? '退出✓' : '退出✗') : '退出?',
                  '合约?',
                ].join(' · ');
                const isSelected = selected === signal.assetId;
                return (
                  <tr key={signal.assetId} className={`border-t cursor-pointer hover:bg-muted/50 ${isSelected ? 'bg-muted/50' : ''}`} onClick={() => setSelected(signal.assetId)}>
                    <td className="py-2 font-mono">{short(signal.assetId)}</td>
                    <td>{signal.event.label} → {signal.narrative.label}</td>
                    <td><span className="text-muted-foreground">NOT-COMPUTABLE</span></td>
                    <td className="text-muted-foreground">{riskBits}</td>
                    <td className="font-mono">{SNIPE_V0.id}</td>
                    <td>
                      {verdict.enter
                        ? <Badge>READY · {verdict.notionalUsdc} USDC</Badge>
                        : <Badge variant="destructive">SKIP · {verdict.reason}</Badge>}
                    </td>
                  </tr>
                );
              })}
              {(state?.pool.length ?? 0) === 0 ? <tr><td colSpan={6} className="py-3 text-muted-foreground">阻击池空 · 等待下一次符合策略的出生</td></tr> : null}
            </tbody>
          </table>
          {(state?.open.length ?? 0) > 0 ? (
            <div className="mt-4 space-y-2">
              <div className="text-xs font-semibold text-muted-foreground">已持仓（点击查看退出论点）</div>
              {state?.open.map((p) => {
                const thesis = state.exitTheses.find((t) => t.mint === p.mint)?.exit;
                return (
                  <div key={p.mint} className="flex items-center justify-between gap-2 border rounded-lg p-2 text-xs cursor-pointer hover:bg-muted/50" onClick={() => setSelected(p.mint)}>
                    <span className="font-mono">{short(p.mint)}</span>
                    <span className="text-muted-foreground">入场 slot {p.entrySlot} · {p.notionalUsdc} USDC</span>
                    {thesis ? <Badge variant={thesis.action === 'EXIT' ? 'destructive' : 'secondary'}>{thesis.action} · {thesis.kind}</Badge> : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {view ? (
        <Card>
          <CardHeader>
            <CardTitle>
              选中：{view.kind === 'candidate' ? short(view.row.signal.assetId) : short(view.position.mint)}
              <span className="text-xs font-normal text-muted-foreground"> · 为什么选择它 / 敢不敢打 / 怎么打 / 怎么退</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {view.kind === 'candidate' ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-2">为什么进入阻击池（证据链）</div>
                    <ol className="text-xs space-y-1.5 list-decimal list-inside">
                      <li>热点事件：{view.row.signal.event.label} · 关注度 {view.row.signal.event.attention.toFixed(2)} · 级别 <span className="text-muted-foreground">NOT-COMPUTABLE（需 B3）</span></li>
                      <li>叙事形成：{view.row.signal.narrative.label}（{view.row.signal.narrative.id}）</li>
                      <li>链上资产：{view.row.signal.launch.venue} · {view.row.signal.launch.quote} 计价 · 初始储备 {view.row.signal.launch.initialReserve} {view.row.signal.launch.reserveUnit} · slot {view.row.signal.launch.clock ?? '—'}</li>
                      <li>市场检查：{view.row.signal.book ? `点时簿在 · 当前储备 ${view.row.signal.book.quoteReserve} SOL · 门槛 ≥${SNIPE_V0.minReserveSolEq}` : '无点时簿'}</li>
                      <li>资金：{view.row.signal.money.flowIn === false ? '流出 → 拒绝' : view.row.signal.money.flowIn === true ? '流入' : 'UNKNOWN（允许未知，禁止流出）'}</li>
                      <li>判定：{view.row.verdict.enter ? `READY · 拟投 ${view.row.verdict.notionalUsdc} USDC（0.5% NAV）` : `SKIP · ${view.row.verdict.reason}`}</li>
                    </ol>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-2">风险扫描（fail-closed 展示）</div>
                    <div className="text-xs space-y-1.5">
                      <div className="flex justify-between"><span>合约风险 · Mint/Freeze Authority</span><span><RiskDot state="unknown" /> {UNKNOWN}</span></div>
                      <div className="flex justify-between"><span>流动性</span><span><RiskDot state={view.row.signal.book ? 'pass' : 'unknown'} /> {view.row.signal.book ? `${view.row.signal.book.quoteReserve} SOL` : UNKNOWN}</span></div>
                      <div className="flex justify-between"><span>持仓集中度</span><span><RiskDot state="unknown" /> {UNKNOWN}</span></div>
                      <div className="flex justify-between"><span>关联钱包</span><span><RiskDot state="unknown" /> {UNKNOWN}</span></div>
                      <div className="flex justify-between"><span>退出可行性（底线 {SNIPE_V0.exitReserveSolEq} SOL）</span><span><RiskDot state={view.row.signal.book ? (view.row.signal.book.quoteReserve >= SNIPE_V0.exitReserveSolEq ? 'pass' : 'fail') : 'unknown'} /> {view.row.signal.book ? (view.row.signal.book.quoteReserve >= SNIPE_V0.exitReserveSolEq ? 'PASS' : 'FAIL') : UNKNOWN}</span></div>
                      <div className="flex justify-between"><span>聪明钱</span><span><RiskDot state="unknown" /> {view.row.signal.money.earlyWallets == null ? UNKNOWN : String(view.row.signal.money.earlyWallets)}</span></div>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground border-t pt-3">
                  说明：事件级别 S/A/B/C 与 EIS 分离（FROZEN-rev1 §6：B4 校准前不存在合成分）；Strategy Matrix（事件×风险→策略）属策略版本演进，当前执行 {SNIPE_V0.id} 统一规则。
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-2">Entry · 为什么进 / 怎么打</div>
                    <div className="text-xs space-y-1.5">
                      <div className="flex justify-between"><span>策略</span><span className="font-mono">{SNIPE_V0.id}</span></div>
                      <div className="flex justify-between"><span>投入</span><span>{view.position.notionalUsdc} USDC（0.5% NAV 上限）</span></div>
                      <div className="flex justify-between"><span>入场 slot</span><span>{view.position.entrySlot}</span></div>
                      <div className="flex justify-between"><span>进场规则</span><span>储备 ≥ {SNIPE_V0.minReserveSolEq} SOL 等值 · 点时簿在</span></div>
                      <div className="flex justify-between"><span>执行</span><span>DRY_RUN 自动 · 无广播</span></div>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-2">Exit · 风控闭环</div>
                    <div className="text-xs space-y-1.5">
                      <div className="flex justify-between"><span>当前论点</span><span>{view.thesis ? `${view.thesis.action} · ${view.thesis.kind}（${view.thesis.why.join('；')}）` : '—'}</span></div>
                      <div className="flex justify-between"><span>止盈 / 止损 / Trailing</span><span className="text-muted-foreground">未启用 · 待 mark price 规则</span></div>
                      <div className="pt-2 space-y-2">
                        <div>
                          <div className="flex justify-between text-muted-foreground"><span>持有进度（{SNIPE_V0.maxHoldSlots} slot 上限）</span><span>{Math.min(state ? state.decisionSlot - view.position.entrySlot : 0, SNIPE_V0.maxHoldSlots)} / {SNIPE_V0.maxHoldSlots}</span></div>
                          <Bar ratio={(state ? state.decisionSlot - view.position.entrySlot : 0) / SNIPE_V0.maxHoldSlots} tone="info" />
                        </div>
                        <div>
                          <div className="flex justify-between text-muted-foreground"><span>储备水平（底线 {SNIPE_V0.exitReserveSolEq} SOL · 入场档 {SNIPE_V0.minReserveSolEq} SOL）</span><span>{state?.exitTheses.find((t) => t.mint === view.position.mint)?.reserveSol ?? '—'} SOL</span></div>
                          <Bar ratio={Math.min(1, (state?.exitTheses.find((t) => t.mint === view.position.mint)?.reserveSol ?? 0) / SNIPE_V0.minReserveSolEq)} tone={(state?.exitTheses.find((t) => t.mint === view.position.mint)?.reserveSol ?? 0) >= SNIPE_V0.exitReserveSolEq ? 'ok' : 'warn'} />
                        </div>
                      </div>
                      <div className="text-muted-foreground pt-1">活跃退出规则：储备 &lt; {SNIPE_V0.exitReserveSolEq} SOL · 持有 ≥ {SNIPE_V0.maxHoldSlots} slot · 退市不可退出</div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle>自动成交 / 拒绝 / 退出 <span className="text-xs font-normal text-muted-foreground">· 证明策略在拒绝什么与成交什么</span></CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {fills.length === 0 && skips.length === 0 ? <p className="text-sm text-muted-foreground">本轮尚未产生判定</p> : null}
          {[...fills.slice(-8).reverse(), ...skips.slice(-6).reverse()].map((t, i) => (
            <div key={`${t.mint}-${t.side}-${i}`} className="flex items-center justify-between gap-2 border rounded-lg p-2 text-xs">
              <span className="font-mono">{short(t.mint)}</span>
              <Badge variant={t.side === 'BUY' ? 'secondary' : 'destructive'}>{t.side}</Badge>
              <span className="text-muted-foreground">{t.skip ? `SKIP · ${t.skip}` : `${t.label ?? '—'}${t.exitReason ? ` · ${t.exitReason}` : ''}`}</span>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">赚钱能力：{state?.money ?? 'NO-EVIDENCE'} · 夹具自动循环不是样本外证据</p>
        </CardContent>
      </Card>
    </main>
  );
}
