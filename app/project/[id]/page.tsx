'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useDb } from '@/app/providers';
import { getProjectDetail } from '@/lib/queries';
import { refreshProject } from '@/lib/star-engine';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ProjectAudit() {
  const { id } = useParams<{ id: string }>();
  const db = useDb();
  const [data, setData] = useState<Awaited<ReturnType<typeof getProjectDetail>> | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!db) return;
    const d = await getProjectDetail(db, id);
    setData(d);
  }, [db, id]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    if (!db) return;
    setLoading(true);
    await refreshProject(db, id);
    await load();
    setLoading(false);
  };

  if (!data) return null;
  const { project, narrative, token, pools, evidence, gates, score, wallets, entities, edges, decision } = data;

  const scoreBar = (label: string, value: number) => (
    <div key={label} className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{Math.round(value || 0)}</span>
      </div>
      <div className="h-2 bg-muted rounded overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${Math.min(100, value || 0)}%` }} />
      </div>
    </div>
  );

  return (
    <main className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{project.name} <span className="text-muted-foreground text-base font-normal">({project.symbol})</span></h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <span>{narrative?.name}</span>
            <span>·</span>
            <Badge variant="secondary">{project.lifecycle}</Badge>
            <span>·</span>
            <span>readiness {project.decisionReadiness.toFixed(2)}</span>
          </div>
        </div>
        <Button size="sm" onClick={onRefresh} disabled={loading}>{loading ? '刷新中…' : '重新评估'}</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Hard Gate</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {gates.map(g => (
              <div key={g.category} className="flex items-center justify-between">
                <span className="capitalize text-sm">{g.category}</span>
                <Badge variant={g.status === 'PASS' ? 'default' : g.status === 'FAIL' ? 'destructive' : 'outline'}>{g.status}</Badge>
              </div>
            ))}
            {gates.some(g => g.status === 'FAIL') && (
              <div className="text-xs text-destructive pt-2">关键失败阻断晋级</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Opportunity Score</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="text-3xl font-bold">{score ? Math.round(score.total) : '—'}</div>
            {score && (
              <>
                {scoreBar('Narrative', score.narrative)}
                {scoreBar('Team/Product', score.teamProduct)}
                {scoreBar('Capital/Holders', score.capitalHolders)}
                {scoreBar('Market Structure', score.marketStructure)}
                {scoreBar('Lifecycle Fit', score.lifecycleFit)}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Identity & Exit</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Website</span><span className="text-muted-foreground">{project.website || '—'}</span></div>
            <div className="flex justify-between"><span>GitHub</span><span className="text-muted-foreground">{project.github || '—'}</span></div>
            <div className="flex justify-between"><span>Twitter</span><span className="text-muted-foreground">{project.twitter || '—'}</span></div>
            <div className="flex justify-between"><span>Mint</span><span className="text-muted-foreground">{token?.mintAuthority || '—'}</span></div>
            <div className="flex justify-between"><span>Freeze</span><span className="text-muted-foreground">{token?.freezeAuthority || '—'}</span></div>
            {pools.map(p => (
              <div key={p.id} className="flex justify-between">
                <span>{p.dex} {p.pair}</span>
                <span className="text-muted-foreground">TVL ${p.tvlUsd?.toLocaleString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="evidence">
        <TabsList>
          <TabsTrigger value="evidence">Evidence Timeline</TabsTrigger>
          <TabsTrigger value="wallets">Wallet / Entity</TabsTrigger>
          <TabsTrigger value="decision">Decision</TabsTrigger>
        </TabsList>
        <TabsContent value="evidence" className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>observed_at</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Conclusion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {evidence.map(e => (
                <TableRow key={e.id}>
                  <TableCell>{new Date(e.observedAt).toLocaleDateString()}</TableCell>
                  <TableCell><Badge variant="outline">{e.type}</Badge></TableCell>
                  <TableCell>{e.source}</TableCell>
                  <TableCell>{e.conclusion}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="wallets" className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entity</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Address / Wallet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entities.map(e => (
                <TableRow key={e.id}>
                  <TableCell>{e.name}</TableCell>
                  <TableCell>{e.type}</TableCell>
                  <TableCell>{Math.round(e.confidence * 100)}%</TableCell>
                  <TableCell>{wallets.filter(w => w.entityId === e.id).map(w => w.address).join(', ')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="text-sm text-muted-foreground">关联边：{edges.map(e => `${e.source} → ${e.target} (${e.type}, ${e.confidence})`).join(' · ')}</div>
        </TabsContent>

        <TabsContent value="decision" className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-2">
              <div className="font-semibold">当前结论</div>
              <div className="text-muted-foreground">{decision?.conclusion || '尚未形成决策'}</div>
              <div className="font-semibold mt-4">反证条件</div>
              <div className="text-muted-foreground">{decision?.falsification || '—'}</div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}
