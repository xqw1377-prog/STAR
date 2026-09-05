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
import { shortHash } from '@/lib/data/lineage';
import { QueryError } from '@/components/query-error';
import { CHECK_ZH, GATE_ZH, INELIGIBLE_ZH, LIFECYCLE_ZH, LINEAGE_ZH, STATUS_ZH, zh, zhReason, zhSource } from '@/lib/ui/zh';
import { observePage } from '@/app/observe-shell';

function ProjectAudit() {
  const { id } = useParams<{ id: string }>();
  const db = useDb();
  const [data, setData] = useState<Awaited<ReturnType<typeof getProjectDetail>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!db) return;
    try {
      setError(null);
      const d = await getProjectDetail(db, id);
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    }
  }, [db, id]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    if (!db) return;
    setLoading(true);
    try {
      await refreshProject(db, id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '刷新失败');
    } finally {
      setLoading(false);
    }
  };

  if (!data && !error) return null;
  if (!data) {
    return (
      <main className="p-6 space-y-6 max-w-6xl mx-auto">
        <QueryError message={error ?? '加载失败'} />
      </main>
    );
  }
  const { project, narrative, token, pools, evidence, gates, score, wallets, entities, edges, decision, evaluation, lineage } = data;

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
          {error ? <QueryError message={error} /> : null}
          <h1 className="text-2xl font-bold tracking-tight">{project.name} <span className="text-muted-foreground text-base font-normal">({project.symbol})</span></h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <span>{narrative?.name}</span>
            <span>·</span>
            <Badge variant="secondary">{zh(LIFECYCLE_ZH, project.lifecycle)}</Badge>
            <span>·</span>
            <span>就绪度 {project.decisionReadiness.toFixed(2)}</span>
          </div>
        </div>
        <Button size="sm" onClick={onRefresh} disabled={loading}>{loading ? '重算中…' : '按已有证据重算'}</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">硬门禁</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {gates.map(g => (
              <div key={g.category} className="flex items-center justify-between">
                <span className="text-sm">{zh(GATE_ZH, g.category)}</span>
                <Badge variant={g.status === 'PASS' ? 'default' : g.status === 'FAIL' ? 'destructive' : 'outline'}>{zh(STATUS_ZH, g.status)}</Badge>
              </div>
            ))}
            {evaluation.gates.filter((g) => g.status !== 'PASS').map((g) => (
              <div key={`${g.gate}-gap`} className="text-xs text-muted-foreground pt-1">
                {zh(GATE_ZH, g.gate)}：{zhReason(g.reason)} · 责任=采集器 · 下次重试=来源恢复后
              </div>
            ))}
            {evaluation.ineligible.map((item) => (
              <div key={`inel-${item.id}`} className="text-xs text-amber-700 dark:text-amber-400 pt-1">
                资格冻结 {zh(INELIGIBLE_ZH, item.reason)} · 证据 {item.id} · 不进门禁
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">机会分数</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="text-3xl font-bold">{score ? Math.round(score.total) : '—'}</div>
            {score && (
              <>
                {scoreBar('叙事', score.narrative)}
                {scoreBar('团队/产品', score.teamProduct)}
                {scoreBar('资金/持币', score.capitalHolders)}
                {scoreBar('市场结构', score.marketStructure)}
                {scoreBar('生命周期拟合', score.lifecycleFit)}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">身份与退出</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>网站</span><span className="text-muted-foreground">{project.website || '—'}</span></div>
            <div className="flex justify-between"><span>GitHub</span><span className="text-muted-foreground">{project.github || '—'}</span></div>
            <div className="flex justify-between"><span>推特</span><span className="text-muted-foreground">{project.twitter || '—'}</span></div>
            <div className="flex justify-between"><span>铸币权限</span><span className="text-muted-foreground">{token?.mintAuthority || '—'}</span></div>
            <div className="flex justify-between"><span>冻结权限</span><span className="text-muted-foreground">{token?.freezeAuthority || '—'}</span></div>
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
          <TabsTrigger value="evidence">证据时间线</TabsTrigger>
          <TabsTrigger value="wallets">钱包 / 实体</TabsTrigger>
          <TabsTrigger value="decision">决策</TabsTrigger>
        </TabsList>
        <TabsContent value="evidence" className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>观察时间</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>来源</TableHead>
                <TableHead>结论</TableHead>
                <TableHead>哈希 → 回执</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {evidence.map(e => {
                const link = lineage.find((row) => row.evidenceId === e.id);
                return (
                <TableRow key={e.id}>
                  <TableCell>{new Date(e.observedAt).toLocaleDateString('zh-CN')}</TableCell>
                  <TableCell><Badge variant="outline">{zh(CHECK_ZH, e.type)}</Badge></TableCell>
                  <TableCell>{zhSource(e.source)}</TableCell>
                  <TableCell>{e.conclusion}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {shortHash(link?.evidenceHash ?? e.hash)}
                    {link?.receiptId ? ` → ${zh(LINEAGE_ZH, link.status)}` : ` · ${LINEAGE_ZH.UNLINKED}`}
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="wallets" className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>实体</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>置信</TableHead>
                <TableHead>地址 / 钱包</TableHead>
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

export default observePage(ProjectAudit);
