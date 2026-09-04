import { seedDatabase } from '@/db/seed';
import { getDb } from '@/db/client';
import { NextResponse } from 'next/server';
import { assertWritable, writeDeniedResponse } from '@/lib/security/write-guard';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    assertWritable(req);
    const db = await getDb();
    const result = await seedDatabase(db);
    return NextResponse.json(result);
  } catch (e: unknown) {
    const denied = writeDeniedResponse(e);
    if (denied) return NextResponse.json(denied.body, { status: denied.status });
    // L5: 服务端记录完整堆栈用于排障，不把内部细节泄入响应体。
    console.error('[seed] internal error', e);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
