import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import * as s from '@/db/schema';
import { collectProject } from '@/lib/data/collect';
import { createProvider, providerStatus } from '@/lib/data/provider';
import { SourceNotEnabledError } from '@/lib/data/source-registry';
import { assertWritable, writeDeniedResponse } from '@/lib/security/write-guard';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(providerStatus());
}

export async function POST(req: Request) {
  try {
    assertWritable(req);
    const body = await req.json().catch(() => ({}));
    if (!body.projectId || typeof body.projectId !== 'string') {
      return NextResponse.json({ ok: false, error: 'projectId is required' }, { status: 400 });
    }

    const db = await getDb();
    const projects = await db.select().from(s.projects).where(eq(s.projects.id, body.projectId));

    if (!projects.length) {
      return NextResponse.json({ ok: false, error: 'no projects (seed first)' }, { status: 400 });
    }

    if (body.provider === 'solana-rpc') {
      try {
        const { assertSourceEnabled } = await import('@/lib/data/source-registry');
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

    const p = projects[0];
    const provider = body.provider === 'solana-rpc'
      ? (await import('@/lib/data/solana-rpc')).createSolanaRpcProvider()
      : body.provider === 'fixture'
        ? (await import('@/lib/data/fixture-provider')).createFixtureProvider(p.id)
        : createProvider(p.id);
    try {
      const result = await collectProject(db, p.id, provider);
      return NextResponse.json({ ok: true, provider: providerStatus(), results: [result] });
    } catch (e: unknown) {
      return NextResponse.json({
        ok: false,
        provider: providerStatus(),
        results: [{ projectId: p.id, provider: provider.id, error: e instanceof Error ? e.message : String(e) }],
      });
    }
  } catch (e: unknown) {
    const denied = writeDeniedResponse(e);
    if (denied) return NextResponse.json(denied.body, { status: denied.status });
    // L5: 服务端记录完整堆栈用于排障，不把内部细节泄入响应体。
    console.error('[collect] internal error', e);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
