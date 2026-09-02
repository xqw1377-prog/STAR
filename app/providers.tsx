'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { initDb, StarDb } from '@/lib/db';

const DbContext = createContext<StarDb | null>(null);

export function useDb() {
  return useContext(DbContext);
}

export function DbProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<StarDb | null>(null);

  useEffect(() => {
    initDb().then(setDb).catch(err => console.error('DB init failed', err));
  }, []);

  if (!db) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        <div className="text-center space-y-2">
          <div className="text-lg font-medium">STAR 初始化中…</div>
          <div className="text-sm">正在加载 PGlite、建表并灌入 Fixtures</div>
        </div>
      </div>
    );
  }

  return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
}
