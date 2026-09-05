export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  if (process.env.VITEST) return;
  const { startSnipeLoop } = await import('./lib/alpha/execution/loop');
  startSnipeLoop();
}
