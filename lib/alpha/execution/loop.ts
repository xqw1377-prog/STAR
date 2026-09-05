import { tickSnipeRuntime } from './runtime';

const INTERVAL_MS = 2000;

declare global {
  // eslint-disable-next-line no-var
  var __starSnipeLoop: ReturnType<typeof setInterval> | undefined;
}

/** Process-level auto tick. Browser poll is not required for the strategy to run. */
export function startSnipeLoop(): void {
  if (globalThis.__starSnipeLoop) return;
  tickSnipeRuntime();
  globalThis.__starSnipeLoop = setInterval(() => {
    tickSnipeRuntime();
  }, INTERVAL_MS);
}

export function stopSnipeLoop(): void {
  if (!globalThis.__starSnipeLoop) return;
  clearInterval(globalThis.__starSnipeLoop);
  globalThis.__starSnipeLoop = undefined;
}
