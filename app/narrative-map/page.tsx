'use client';

import { useEffect, useState } from 'react';
import { useDb } from '@/app/providers';
import { getNarratives } from '@/lib/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { LIFECYCLE_ZH, zh } from '@/lib/ui/zh';

export default function NarrativeMap() {
  const db = useDb();
  const [narratives, setNarratives] = useState<Awaited<ReturnType<typeof getNarratives>>>([]);

  useEffect(() => {
    if (!db) return;
    getNarratives(db).then(setNarratives);
  }, [db]);

  const chart = narratives.map(n => ({
    name: n.name,
    新颖: n.novelty * 100,
    速度: n.velocity * 100,
    广度: n.breadth * 100,
    链上: n.onChainConfirm * 100,
    存活: n.survival * 100,
  }));

  return (
    <main className="p-6 space-y-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight">叙事地图</h1>
      <p className="text-sm text-muted-foreground">语义簇、阶段与速度/广度信号</p>

      <div className="h-64 bg-card border rounded-lg p-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart}>
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Bar dataKey="新颖" fill="#38bdf8" />
            <Bar dataKey="速度" fill="#34d399" />
            <Bar dataKey="广度" fill="#fbbf24" />
            <Bar dataKey="链上" fill="#f87171" />
            <Bar dataKey="存活" fill="#a78bfa" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {narratives.map(n => (
          <Card key={n.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle>{n.name}</CardTitle>
                <Badge variant="secondary">{zh(LIFECYCLE_ZH, n.stage)}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-2 text-center text-xs">
                <div><div className="font-semibold">{Math.round(n.novelty * 100)}</div><div className="text-muted-foreground">新颖</div></div>
                <div><div className="font-semibold">{Math.round(n.velocity * 100)}</div><div className="text-muted-foreground">速度</div></div>
                <div><div className="font-semibold">{Math.round(n.breadth * 100)}</div><div className="text-muted-foreground">广度</div></div>
                <div><div className="font-semibold">{Math.round(n.onChainConfirm * 100)}</div><div className="text-muted-foreground">链上</div></div>
                <div><div className="font-semibold">{Math.round(n.survival * 100)}</div><div className="text-muted-foreground">存活</div></div>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">别名：{n.aliases.join(', ') || '—'}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
