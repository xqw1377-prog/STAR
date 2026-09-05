'use client';

import { useEffect, useState } from 'react';
import { useDb } from '@/app/providers';
import { getProjectsWithReadiness } from '@/lib/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { QueryError } from '@/components/query-error';
import { GATE_ZH, INELIGIBLE_ZH, READINESS_ZH, STATUS_ZH, zh, zhReason } from '@/lib/ui/zh';
import { observePage } from '@/app/observe-shell';

function RiskCenter() {
  const db = useDb();
  const [projects, setProjects] = useState<Awaited<ReturnType<typeof getProjectsWithReadiness>>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db) return;
    setError(null);
    getProjectsWithReadiness(db).then(setProjects).catch((e) => setError(e instanceof Error ? e.message : '加载失败'));
  }, [db]);

  const rows = projects.flatMap((p) =>
    p.evaluation.gates
      .filter((g) => g.status !== 'PASS')
      .map((g) => ({
        projectId: p.id,
        name: p.name,
        readiness: p.evaluation.readiness,
        gate: g.gate,
        status: g.status,
        reason: g.reason,
      })),
  );
  const frozen = projects.flatMap((p) =>
    p.evaluation.ineligible.map((item) => ({
      projectId: p.id,
      name: p.name,
      reason: item.reason,
      id: item.id,
    })),
  );

  return (
    <main className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">风险中心</h1>
        <p className="text-sm text-muted-foreground">当前会推翻判断的未通过 / 未知项。合成夹具，不是实时告警总线。</p>
      </div>
      {error ? <QueryError message={error} /> : null}
      <Card>
        <CardHeader>
          <CardTitle>开放风险 {rows.length}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {rows.map((r) => (
            <Link key={`${r.projectId}-${r.gate}`} href={`/project/${r.projectId}`} className="block border rounded-lg p-3 hover:bg-muted">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">{r.name} · {zh(GATE_ZH, r.gate)}</div>
                <Badge variant={r.status === 'FAIL' ? 'destructive' : 'outline'}>{zh(STATUS_ZH, r.status)}</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1">{zhReason(r.reason)}</div>
              <div className="text-xs mt-1">就绪度 {zh(READINESS_ZH, r.readiness)} · 责任=采集器 · 下次=来源恢复后重试</div>
            </Link>
          ))}
        </CardContent>
      </Card>
      {frozen.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>资格冻结 {frozen.length}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {frozen.map((item) => (
              <Link key={`${item.projectId}-${item.id}`} href={`/project/${item.projectId}`} className="block border rounded-lg p-3 hover:bg-muted">
                <div className="font-medium">{item.name}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {zh(INELIGIBLE_ZH, item.reason)} · 证据 {item.id} · 不进门禁
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </main>
  );
}

export default observePage(RiskCenter);
