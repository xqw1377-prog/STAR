'use client';

import { useEffect, useState } from 'react';
import { useDb } from '@/app/providers';
import { getNarratives, getProjectsWithReadiness } from '@/lib/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { QueryError } from '@/components/query-error';
import { LIFECYCLE_ZH, READINESS_ZH, zh } from '@/lib/ui/zh';
import { observePage } from '@/app/observe-shell';

function CycleRadar() {
  const db = useDb();
  const [narratives, setNarratives] = useState<Awaited<ReturnType<typeof getNarratives>>>([]);
  const [projects, setProjects] = useState<Awaited<ReturnType<typeof getProjectsWithReadiness>>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db) return;
    setError(null);
    Promise.all([
      getNarratives(db).then(setNarratives),
      getProjectsWithReadiness(db).then(setProjects),
    ]).catch((e) => setError(e instanceof Error ? e.message : '加载失败'));
  }, [db]);

  return (
    <main className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">周期雷达</h1>
        <p className="text-sm text-muted-foreground">合成夹具上的叙事迁移与项目阶段，不是真实资金流。</p>
      </div>
      {error ? <QueryError message={error} /> : null}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {narratives.map((n) => {
          const members = projects.filter((p) => p.narrativeId === n.id);
          return (
            <Card key={n.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{n.name}</span>
                  <Badge variant="secondary">{zh(LIFECYCLE_ZH, n.stage)}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="grid grid-cols-5 gap-1 text-xs text-muted-foreground">
                  <span>新颖 {(n.novelty * 100).toFixed(0)}</span>
                  <span>速度 {(n.velocity * 100).toFixed(0)}</span>
                  <span>广度 {(n.breadth * 100).toFixed(0)}</span>
                  <span>链上 {(n.onChainConfirm * 100).toFixed(0)}</span>
                  <span>存活 {(n.survival * 100).toFixed(0)}</span>
                </div>
                {members.map((p) => (
                  <Link key={p.id} href={`/project/${p.id}`} className="flex justify-between border rounded p-2 hover:bg-muted">
                    <span>{p.name}</span>
                    <span className="text-muted-foreground">{zh(READINESS_ZH, p.evaluation.readiness)}</span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </main>
  );
}

export default observePage(CycleRadar);
