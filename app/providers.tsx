'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { initDb, StarDb } from '@/lib/db';

const DbContext = createContext<StarDb | null>(null);

export function useDb() {
  return useContext(DbContext);
}

/**
 * P0-C2: PGlite 初始化失败必须显式降级。加载态会终止，错误视图不渲染
 * 任何项目结论、门禁状态或机会分数（无旧缓存回退），“重新加载”仅重试
 * 初始化本身——初始化失败是数据可用性问题，不是项目风险，绝不进入
 * 门禁或评分语义。
 */
export function DbProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<StarDb | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    initDb()
      .then((d) => {
        if (!cancelled) setDb(d);
      })
      .catch((err) => {
        console.error('DB init failed', err);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [retry]);

  if (db) {
    return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
  }

  if (failed) {
    return (
      <main
        data-testid="data-unavailable"
        role="alert"
        className="flex min-h-screen items-center justify-center p-6"
      >
        <div className="max-w-md space-y-4 text-center">
          <div className="font-mono text-sm font-bold tracking-widest text-destructive">
            DATA UNAVAILABLE
          </div>
          <p className="text-sm text-muted-foreground">本地研究数据初始化失败。</p>
          <p className="text-sm text-muted-foreground">
            STAR 未加载任何项目结论、门禁状态或机会分数。
          </p>
          <button
            type="button"
            onClick={() => setRetry((n) => n + 1)}
            className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            重新加载
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center text-slate-500">
      <div className="text-center space-y-2">
        <div className="text-lg font-medium">STAR 初始化中…</div>
        <div className="text-sm">正在加载 PGlite、建表并灌入 Fixtures</div>
      </div>
    </div>
  );
}
