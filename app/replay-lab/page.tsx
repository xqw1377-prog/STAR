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
import { runReplay, type ReplayMode, type ReplayRun } from '@/lib/queries';
import { shortHash } from '@/lib/data/lineage';
import { ReplayError } from '@/lib/data/resolve';
import { QueryError } from '@/components/query-error';
import { CHECK_ZH, GATE_ZH, INELIGIBLE_ZH, LINEAGE_ZH, READINESS_ZH, REPLAY_MODE_ZH, STATUS_ZH, zh, zhReason, zhSource } from '@/lib/ui/zh';
import { observePage } from '@/app/observe-shell';

const STATUS_COLOR: Record<string, string> = {
  PASS: 'text-green-600',
  FAIL: 'text-red-600',
  UNKNOWN: 'text-amber-600',
};

function ReplayLab() {
  const db = useDb();
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [asOf, setAsOf] = useState<string>('2026-08-23T12:00');
  const [mode, setMode] = useState<ReplayMode>('HISTORICAL');
  const [run, setRun] = useState<ReplayRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!db) return;
    db.select({ id: s.projects.id, name: s.projects.name }).from(s.projects)
      .then(setProjects)
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'));
  }, [db]);

  const onReplay = async () => {
    if (!db || !selected) return;
    setLoading(true);
    setError(null);
    try {
      const asOfDate = new Date(/Z$|[+-]\d{2}:\d{2}$/.test(asOf) ? asOf : `${asOf}:00Z`);
      setRun(await runReplay(db, { projectId: selected, asOf: asOfDate, mode }));
    } catch (err) {
      const message = err instanceof ReplayError
        ? `${err.code}: ${err.message}`
        : err instanceof Error ? err.message : '回放失败';
      setError(message);
      setRun(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="p-6 space-y-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight">回放实验室</h1>
      <p className="text-sm text-muted-foreground">
        历史冻结会锁住解释上下文与工件后再重放；重新解释使用当前工件并显式标记。
        证据截止仍按观察时间 ≤ 所选时点，时点后门禁不得偷看。
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
            <label className="text-sm font-medium">回放时点（观察时间 ≤）</label>
            <Input type="datetime-local" value={asOf} onChange={e => setAsOf(e.target.value)} className="w-56" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">模式</label>
            <Select value={mode} onValueChange={(v) => setMode((v as ReplayMode) || 'HISTORICAL')}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HISTORICAL">{REPLAY_MODE_ZH.HISTORICAL}</SelectItem>
                <SelectItem value="REINTERPRET">{REPLAY_MODE_ZH.REINTERPRET}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={onReplay} disabled={loading || !selected}>{loading ? '回放中…' : '运行回放'}</Button>
        </CardContent>
      </Card>

      {error ? <QueryError message={error} /> : null}

      {run && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <CardTitle>时点门禁 · {new Date(run.evaluation.asOf).toLocaleString('zh-CN')}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant={run.mode === 'HISTORICAL' ? 'default' : 'outline'}>{zh(REPLAY_MODE_ZH, run.mode)}</Badge>
                  {run.evaluation.score
                    ? <Badge>总分 {Math.round(run.evaluation.score.total)} · 置信 {run.evaluation.score.confidence} · {zh(READINESS_ZH, run.evaluation.readiness)}</Badge>
                    : <Badge variant="destructive">{zh(READINESS_ZH, run.evaluation.readiness)}（{run.evaluation.blockedBy.length} 项未通过）</Badge>}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-muted-foreground font-mono break-all">
                上下文 {run.contextId ?? '—（重新解释不冻结事实集）'} ·
                契约 {run.artifacts.contract} · 规则 {run.artifacts.rule} ·
                资格策略 {run.artifacts.eligibility}
              </div>
              {run.evaluation.gates.map(g => (
                <div key={g.gate} className="border-b py-2 last:border-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <span className="font-medium">{zh(GATE_ZH, g.gate)}</span>
                      <div className="text-xs text-muted-foreground">{zhReason(g.reason)}</div>
                    </div>
                    <span className={`font-medium shrink-0 ${STATUS_COLOR[g.status]}`}>{zh(STATUS_ZH, g.status)}</span>
                  </div>
                </div>
              ))}
              {run.evaluation.quarantined.length > 0 && (
                <div className="text-xs text-amber-600">
                  {run.evaluation.quarantined.length} 条证据因违反时态规则被隔离（观察时间晚于入库时间等）
                </div>
              )}
              {run.evaluation.ineligible.map((item) => (
                <div key={item.id} className="text-xs text-amber-700">
                  资格冻结 {zh(INELIGIBLE_ZH, item.reason)} · {item.id}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>时点证据（可见 {run.evidenceVisible.length} 条 · 时点后被隐藏 {run.evidenceHidden} 条）</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>观察时间</TableHead>
                    <TableHead>入库时间</TableHead>
                    <TableHead>检查项</TableHead>
                    <TableHead>来源</TableHead>
                    <TableHead>结论</TableHead>
                    <TableHead>哈希</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {run.evidenceVisible.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{new Date(r.observedAt).toISOString().slice(0, 16).replace('T', ' ')}</TableCell>
                      <TableCell className="text-xs">{new Date(r.ingestedAt).toISOString().slice(0, 16).replace('T', ' ')}</TableCell>
                      <TableCell>{zh(CHECK_ZH, r.type)}</TableCell>
                      <TableCell>{zhSource(r.source)}</TableCell>
                      <TableCell>{r.conclusion}</TableCell>
                      <TableCell className="font-mono text-xs">{shortHash(r.hash)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>证据溯源 · 证据哈希 → 回执载荷哈希</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>类型</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>证据哈希</TableHead>
                    <TableHead>回执</TableHead>
                    <TableHead>事实</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {run.lineage.filter((row) => row.observedAt.getTime() <= new Date(run.evaluation.asOf).getTime()).map((row) => (
                    <TableRow key={row.evidenceId}>
                      <TableCell>{zh(CHECK_ZH, row.evidenceType)}</TableCell>
                      <TableCell><Badge variant={row.status === 'LINKED' ? 'secondary' : 'outline'}>{zh(LINEAGE_ZH, row.status)}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{shortHash(row.evidenceHash)}</TableCell>
                      <TableCell className="font-mono text-xs">{row.receiptId ?? '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{row.factId ?? '—'}</TableCell>
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

export default observePage(ReplayLab);
