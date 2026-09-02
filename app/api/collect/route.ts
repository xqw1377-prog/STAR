import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import * as s from '@/db/schema';
import { collectProject } from '@/lib/data/collect';
import { createProvider, providerStatus } from '@/lib/data/provider';
import { SourceNotEnabledError } from '@/lib/data/source-registry';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(providerStatus());
}

/**
 * POST /api/collect { projectId?, provider? }
 * Pulls read-only facts for one project (or all seeded projects) and re-runs
 * the six gates. provider: 'fixture' (default) | 'solana-rpc'. Real sources
 * are rejected with 403 unless enabled in the source registry (DATA-006).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const db = await getDb();
    const projects = body.projectId
      ? await db.select().from(s.projects).where(eq(s.projects.id, body.projectId))
      : await db.select().from(s.projects);

    if (!projects.length) {
      return NextResponse.json({ ok: false, error: 'no projects (seed first)' }, { status: 400 });
    }

    if (body.provider === 'solana-rpc') {
      const { assertSourceEnabled } = await import('@/lib/data/source-registry');
      try {
        assertSourceEnabled('solana-rpc');
      } catch (e) {
        if (e instanceof SourceNotEnabledError) {
          return NextResponse.json(
            { ok: false, error: e.message, reference: 'docs/p0-data/SOURCE_LICENSE_MATRIX.md (DATA-006)' },
            { status: 403 },
          );
        }
        throw e;
      }
    }

    const results = [];
    for (const p of projects) {
      const provider = body.provider === 'solana-rpc'
        ? (await import('@/lib/data/solana-rpc')).createSolanaRpcProvider()
        : body.provider === 'fixture'
          ? (await import('@/lib/data/fixture-provider')).createFixtureProvider(p.id)
          : createProvider(p.id);
      try {
        results.push(await collectProject(db, p.id, provider));
      } catch (e: unknown) {
        results.push({ projectId: p.id, provider: provider.id, error: e instanceof Error ? e.message : String(e) });
      }
    }
    return NextResponse.json({ ok: true, provider: providerStatus(), results });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
