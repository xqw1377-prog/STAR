'use client';

import { useEffect, useState } from 'react';
import { useDb } from '@/app/providers';
import * as s from '@/db/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { evaluateProjectAsOf, type ProjectEvaluation } from '@/lib/engine';
import { and, eq, lte, gt } from 'drizzle-orm';

const STATUS_COLOR: Record<string, string> = {
  PASS: 'text-green-600',
  FAIL: 'text-red-600',
  UNKNOWN: 'text-amber-600',
};

export default function ReplayLab() {
  const db = useDb();
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [asOf, setAsOf] = useState<string>('2026-08-23T12:00');
  const [rows, setRows] = useState<typeof s.evidence.$inferSelect[]>([]);
  const [hidden, setHidden] = useState(0);
  const [evaluation, setEvaluation] = useState<ProjectEvaluation | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!db) return;
    db.select({ id: s.projects.id, name: s.projects.name }).from(s.projects).then(setProjects);
  }, [db]);

  const runReplay = async () => {
    if (!db || !selected) return;
    setLoading(true);
    try {
      const asOfDate = new Date(asOf);
      const visible = await db
        .select()
        .from(s.evidence)
        .where(and(eq(s.evidence.projectId, selected), lte(s.evidence.observedAt, asOfDate)));
      const future = await db
        .select({ id: s.evidence.id })
        .from(s.evidence)
        .where(and(eq(s.evidence.projectId, selected), gt(s.evidence.observedAt, asOfDate)));
      setRows(visible.sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime()));
      setHidden(future.length);
      setEvaluation(await evaluateProjectAsOf(db, selected, asOfDate));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="p-6 space-y-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight">Replay Lab</h1>
      <p className="text-sm text-muted-foreground">
        Point-in-time 回放：仅使用 observed_at ≤ 所选时点的证据重建门禁与分数。引擎与当前视图共用同一时态内核，未来数据泄漏被结构性禁止。
      </p>

      <Card>
        <CardHeader>
          <CardTitle>参数</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 items-end">
          <div className="space-y-2">
            <label className="text-sm font-medium">项目</label>
            <Select value={selected} onValueChange={v => setSelected(v || '')}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="选择项目" />
              </SelectTrigger>
              <SelectContent>
                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">回放时点（observed_at ≤）</label>
            <Input type="datetime-local" value={asOf} onChange={e => setAsOf(e.target.value)} className="w-56" />
          </div>
          <Button onClick={runReplay} disabled={loading || !selected}>{loading ? '回放中…' : '运行回放'}</Button>
        </CardContent>
      </Card>

      {evaluation && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>时点门禁 · {new Date(evaluation.asOf).toLocaleString()}</CardTitle>
                {evaluation.score
                  ? <Badge>总分 {Math.round(evaluation.score.total)} · 置信 {evaluation.score.confidence} · {evaluation.readiness}</Badge>
                  : <Badge variant="destructive">{evaluation.readiness}（{evaluation.blockedBy.length} 项未通过）</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {evaluation.gates.map(g => (
                <div key={g.gate} className="border-b py-2 last:border-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <span className="font-medium">{g.gate}</span>
                      <div className="text-xs text-muted-foreground">{g.reason}</div>
                    </div>
                    <span className={`font-medium shrink-0 ${STATUS_COLOR[g.status]}`}>{g.status}</span>
                  </div>
                </div>
              ))}
              {evaluation.quarantined.length > 0 && (
                <div className="text-xs text-amber-600">
                  {evaluation.quarantined.length} 条证据因违反时态规则被隔离（observedAt &gt; ingestedAt 等）
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>时点证据（可见 {rows.length} 条 · 时点后被隐藏 {hidden} 条）</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>observed_at</TableHead>
                    <TableHead>ingested_at</TableHead>
                    <TableHead>check</TableHead>
                    <TableHead>source</TableHead>
                    <TableHead>claim</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{new Date(r.observedAt).toISOString().slice(0, 16).replace('T', ' ')}</TableCell>
                      <TableCell className="text-xs">{new Date(r.ingestedAt).toISOString().slice(0, 16).replace('T', ' ')}</TableCell>
                      <TableCell>{r.type}</TableCell>
                      <TableCell>{r.source}</TableCell>
                      <TableCell>{r.conclusion}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}
