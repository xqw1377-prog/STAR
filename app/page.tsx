'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { QueryError } from '@/components/query-error';
import { SNIPE_V0 } from '@/lib/alpha/strategy/snipe-v0';

interface SnipeTrade {
  mint: string;
  side: 'BUY' | 'SELL';
  skip?: string;
  exitReason?: string;
  label?: string;
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
  trades: SnipeTrade[];
}

export default function SnipeDesk() {
  const [state, setState] = useState<SnipeState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const pull = () => {
      fetch('/api/snipe', { cache: 'no-store' })
        .then((r) => {
          if (!r.ok) throw new Error(`snipe ${r.status}`);
          return r.json();
        })
        .then((body: SnipeState) => {
          if (!cancelled) {
            setError(null);
            setState(body);
          }
        })
        .catch((e) => {
          if (!cancelled) setError(e instanceof Error ? e.message : '阻击循环失败');
        });
    };
    pull();
    const id = window.setInterval(pull, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const fills = (state?.trades ?? []).filter((t) => !t.skip);

  return (
    <main className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">阻击台</h1>
        <p className="text-sm text-muted-foreground">
          一级链上价值 meme · 策略自动开平仓 · 六门禁不参与入场
        </p>
      </div>
      {error ? <QueryError message={error} /> : null}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">策略</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-sm font-bold">{state?.strategy ?? SNIPE_V0.id}</div>
            <div className="text-xs text-muted-foreground">版本冻结后改规则 = 新实验</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">执行模式</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{state?.mode ?? 'DRY_RUN'}</div>
            <div className="text-xs text-muted-foreground">
              {state?.broadcast ? '广播已接线' : '无广播 · 无钱包模块'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">组合净值</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{state ? state.navUsdc.toFixed(0) : '—'}</div>
            <div className="text-xs text-muted-foreground">现金 {state ? state.cashUsdc.toFixed(0) : '—'} USDC · 夹具记账</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">持仓</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{state?.open.length ?? 0}</div>
            <div className="text-xs text-muted-foreground">上限 {SNIPE_V0.maxPositions} · 单名 0.5% NAV</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">循环</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{state?.tick ?? 0}</div>
            <div className="text-xs text-muted-foreground">slot {state?.decisionSlot ?? '—'} · 自动推进</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>策略规则 snipe-value-meme@v0</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1 text-muted-foreground">
          <p>进场：pump.fun bonding-curve / Raydium AMM v4 / CPMM · 报价 SOL 或 USDC · 首次储备 ≥ 8 SOL 等值 · 点时簿记存在 · 同 mint 一仓</p>
          <p>出场：退市不可退出记 0 · 储备 &lt; 1 SOL · 持有 ≥ 1800 slot</p>
          <p>赚钱能力：{state?.money ?? 'NO-EVIDENCE'} · 夹具自动循环不是样本外证据</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>当前仓位</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(state?.open ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">空仓 · 等待下一次符合策略的出生</p>
            ) : (
              state?.open.map((p) => (
                <div key={p.mint} className="border rounded-lg p-3 font-mono text-xs">
                  <div className="font-semibold break-all">{p.mint}</div>
                  <div className="text-muted-foreground mt-1">入场 slot {p.entrySlot} · {p.notionalUsdc} USDC</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>自动成交 / 退出</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {fills.length === 0 ? (
              <p className="text-sm text-muted-foreground">本轮尚未产生成交</p>
            ) : (
              fills.slice(-12).reverse().map((t, i) => (
                <div key={`${t.mint}-${t.side}-${i}`} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-mono text-xs break-all">{t.mint}</div>
                    <Badge variant={t.side === 'BUY' ? 'secondary' : 'destructive'}>{t.side}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t.label ?? '—'}
                    {t.exitReason ? ` · ${t.exitReason}` : ''}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
