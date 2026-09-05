'use client';

import type { ComponentType } from 'react';
import DbProvider from '@/app/providers-ssr';

/** Research shells only. The snipe desk must not wait on this store. */
export function observePage(Page: ComponentType) {
  return function ObservePage() {
    return (
      <DbProvider>
        <Page />
      </DbProvider>
    );
  };
}
