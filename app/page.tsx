'use client';

import { useEffect, useState } from 'react';
import { useDb } from '@/app/providers';
import { getProjectsWithReadiness, getNarratives, getDeskHealth } from '@/lib/queries';
import { formatRate } from '@/lib/data/health';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { DEGRADED_ZH, GATE_ZH, HEALTH_RATE_ZH, LIFECYCLE_ZH, STATUS_ZH, zh } from '@/lib/ui/zh';

export default function StarDesk() {
  const db = useDb();
  const [projects, setProjects] = useState<Awaited<ReturnType<typeof getProjectsWithReadiness>>>([]);
  const [narratives, setNarratives] = useState<Awaited<ReturnType<typeof getNarratives>>>([]);
  const [health, setHealth] = useState<Awaited<ReturnType<typeof getDeskHealth>> | null>(null);

  useEffect(() => {
    if (!db) return;
    getProjectsWithReadiness(db).then(setProjects);
    getNarratives(db).then(setNarratives);
    getDeskHealth(db).then(setHealth);
  }, [db]);

  const passList = projects
    .filter((p) => p.evaluation.readiness === 'READY' && p.score)
    .sort((a, b) => (b.score?.total || 0) - (a.score?.total || 0));
  const riskList = projects.filter((p) => p.evaluation.readiness !== 'READY');

  return (
    <main className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">研究台</h1>
        <p className="text-sm text-muted-foreground">只读研究台 · 今日候选、风险队列与叙事轮动</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">活跃叙事</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{narratives.length}</div>
            <div className="text-xs text-muted-foreground">Solana 上识别出的叙事</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">可决策项目</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{passList.length}</div>
            <div className="text-xs text-muted-foreground">当前就绪度 = 可决策</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">风险队列</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{riskList.length}</div>
            <div className="text-xs text-muted-foreground">已阻断 / 需补研 / 已过窗口</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>数据采集健康</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            观察能力投影 · 六互斥终态 + 响应可用率 + 未决率 · 不写入就绪度
          </p>
          {health ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground text-xs">{HEALTH_RATE_ZH.success}</div>
                <div className="font-medium">{formatRate(health.overall.success_rate)}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">{HEALTH_RATE_ZH.partial}</div>
                <div className="font-medium">{formatRate(health.overall.partial_rate)}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">{HEALTH_RATE_ZH.source_error}</div>
                <div className="font-medium">{formatRate(health.overall.source_error_rate)}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">{HEALTH_RATE_ZH.transport_error}</div>
                <div className="font-medium">{formatRate(health.overall.transport_error_rate)}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">{HEALTH_RATE_ZH.timeout}</div>
                <div className="font-medium">{formatRate(health.overall.timeout_rate)}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">{HEALTH_RATE_ZH.aborted}</div>
                <div className="font-medium">{formatRate(health.overall.aborted_rate)}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">{HEALTH_RATE_ZH.response_availability}</div>
                <div className="font-medium">{formatRate(health.overall.response_availability)}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">{HEALTH_RATE_ZH.unresolved}</div>
                <div className="font-medium">{formatRate(health.overall.unresolved_rate)}</div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">健康投影未加载</div>
          )}
          {health && (
            <div className="text-xs text-muted-foreground">
              1 小时窗终态 {health.overall.terminal_n} · 启动 {health.overall.start_n} ·
              完整度 {health.overall.completeness == null ? '无计划' : `${Math.round(health.overall.completeness * 100)}%`} ·
              降级 {health.overall.degraded_reason.map((r) => zh(DEGRADED_ZH, r)).join('、')}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>研究队列</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {passList.map(p => (
              <Link key={p.id} href={`/project/${p.id}`} className="block border rounded-lg p-3 hover:bg-muted transition">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{p.name} <span className="text-muted-foreground font-normal">({p.symbol})</span></div>
                    <div className="text-xs text-muted-foreground">{p.narrativeName}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">{p.score ? Math.round(p.score.total) : '—'}</div>
                    <Badge variant={p.lifecycle === 'CROWDING' ? 'destructive' : 'secondary'}>{zh(LIFECYCLE_ZH, p.lifecycle)}</Badge>
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>风险队列</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {riskList.map(p => (
              <Link key={p.id} href={`/project/${p.id}`} className="block border rounded-lg p-3 hover:bg-muted transition">
                <div className="font-semibold">{p.name} <span className="text-muted-foreground font-normal">({p.symbol})</span></div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {p.gates.filter(g => g.status !== 'PASS').map(g => (
                    <Badge key={g.category} variant={g.status === 'FAIL' ? 'destructive' : 'outline'}>{zh(GATE_ZH, g.category)}：{zh(STATUS_ZH, g.status)}</Badge>
                  ))}
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
