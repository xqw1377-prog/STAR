import { seedDatabase } from '@/db/seed';
import { getDb } from '@/db/client';
import { NextResponse } from 'next/server';
import { assertWriteAccess, writeDeniedResponse } from '@/lib/security/write-guard';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    assertWriteAccess(req);
    const db = await getDb();
    const result = await seedDatabase(db);
    return NextResponse.json(result);
  } catch (e: unknown) {
    const denied = writeDeniedResponse(e);
    if (denied) return NextResponse.json(denied.body, { status: denied.status });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
