import { NextResponse } from 'next/server';
import { capabilityPublic } from '@/lib/alpha/capability';

export const dynamic = 'force-dynamic';

/** Read-only paper-vs-runtime ledger. No secrets, not a money-ability claim. */
export async function GET() {
  return NextResponse.json(capabilityPublic(), { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST() {
  return NextResponse.json({ error: 'method not allowed' }, { status: 405 });
}
