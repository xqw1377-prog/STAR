'use client';
// PGlite's idb store is browser-only; never SSR the provider subtree.
import dynamic from 'next/dynamic';

const DbProvider = dynamic(() => import('./providers').then((m) => m.DbProvider), {
  ssr: false,
  loading: () => null,
});

export default DbProvider;
