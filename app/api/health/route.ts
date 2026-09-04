import { NextResponse } from 'next/server';
import { SCHEMA_LABEL } from '@/db/apply-sql';
import { BUILD_SHA } from '@/lib/build-info';

export const dynamic = 'force-dynamic';

/**
 * Liveness probe ONLY — deliberately NOT readiness: it says the process is
 * up and which build/schema it serves. It does NOT attest database health,
 * business-data freshness, or dependency availability (those live in the
 * data-health model, which is display/scheduling only per D0 R5-12).
 * Never include RPC URLs, credentials, or DB paths (S0).
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'liveness',
      ok: true,
      commit: BUILD_SHA,
      build_sha: BUILD_SHA,
      schema: SCHEMA_LABEL,
      contract: 'solana-readonly@3',
      server_time: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

// Method restriction: anything but GET is rejected here.
export async function POST() {
  return NextResponse.json({ error: 'method not allowed' }, { status: 405 });
}
