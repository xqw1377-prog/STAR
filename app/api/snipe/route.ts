import { NextResponse } from 'next/server';
import { snapshotSnipeRuntime, tickSnipeRuntime } from '@/lib/alpha/execution/runtime';
import { SNIPE_V0 } from '@/lib/alpha/strategy/snipe-v0';
import { CAPABILITY } from '@/lib/alpha/capability';

export const dynamic = 'force-dynamic';

const STALE_MS = 2000;

/** Auto-tick if idle. Strategy executes without a human click. */
export async function GET() {
  const snap = snapshotSnipeRuntime();
  const stale = !snap.lastTickAt || Date.now() - Date.parse(snap.lastTickAt) > STALE_MS;
  const body = stale ? tickSnipeRuntime() : snap;
  return NextResponse.json(
    {
      ...body,
      rules: {
        dexes: SNIPE_V0.dexes,
        quotes: SNIPE_V0.quotes,
        minReserveSolEq: SNIPE_V0.minReserveSolEq,
        exitReserveSolEq: SNIPE_V0.exitReserveSolEq,
        maxHoldSlots: SNIPE_V0.maxHoldSlots,
        maxPositions: SNIPE_V0.maxPositions,
        maxNameWeight: SNIPE_V0.maxNameWeight,
      },
      money: CAPABILITY.money,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
