'use client';

import { useEffect, useState } from 'react';
import { useDb } from '@/app/providers';
import { getProjectsWithReadiness, getNarratives } from '@/lib/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default function StarDesk() {
  const db = useDb();
  const [projects, setProjects] = useState<Awaited<ReturnType<typeof getProjectsWithReadiness>>>([]);
  const [narratives, setNarratives] = useState<Awaited<ReturnType<typeof getNarratives>>>([]);

  useEffect(() => {
    if (!db) return;
    getProjectsWithReadiness(db).then(setProjects);
    getNarratives(db).then(setNarratives);
  }, [db]);

  const passList = projects.filter(p => (p.score?.total || 0) > 0).sort((a, b) => (b.score?.total || 0) - (a.score?.total || 0));
  const riskList = projects.filter(p => p.gates.some(g => g.status === 'FAIL' || g.status === 'UNKNOWN'));

  return (
    <main className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">STAR Desk</h1>
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
            <div className="text-xs text-muted-foreground">门禁通过且总分 &gt; 0</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">风险队列</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{riskList.length}</div>
            <div className="text-xs text-muted-foreground">含 FAIL / UNKNOWN 门禁</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top-K 研究队列</CardTitle>
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
                    <Badge variant={p.lifecycle === 'CROWDING' ? 'destructive' : 'secondary'}>{p.lifecycle}</Badge>
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
                    <Badge key={g.category} variant={g.status === 'FAIL' ? 'destructive' : 'outline'}>{g.category}: {g.status}</Badge>
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
