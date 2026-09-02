import { seedDatabase } from '@/db/seed';
import { getDb } from '@/db/client';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const db = await getDb();
    const result = await seedDatabase(db);
    return NextResponse.json(result);
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
