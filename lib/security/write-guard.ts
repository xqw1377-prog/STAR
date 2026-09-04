import { timingSafeEqual } from 'crypto';
import { assertWriteRateLimit } from './rate-limit';
import { WriteDenied } from './write-denied';

export { WriteDenied };

function bearer(req: Request): string | null {
  const raw = req.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(raw);
  return match?.[1] ?? null;
}

function tokenEquals(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) {
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

/**
 * Production write APIs are closed unless STAR_ALLOW_WRITE=1 AND STAR_WRITE_TOKEN
 * is set and matches. A production allow-flag without a token is fail-closed (403).
 * Local/test may omit the token. Never reflect secrets.
 */
export function assertWriteAccess(req: Request): void {
  const production = process.env.NODE_ENV === 'production';
  const allow = process.env.STAR_ALLOW_WRITE === '1';
  const token = process.env.STAR_WRITE_TOKEN ?? '';

  if (production && !allow) {
    throw new WriteDenied(403, 'write APIs disabled in production');
  }
  if (production && allow && !token) {
    throw new WriteDenied(403, 'write token not configured');
  }
  if (token && !tokenEquals(bearer(req) ?? '', token)) {
    throw new WriteDenied(401, 'write token required');
  }
}

/** Rate-limit first, then auth. In-memory limiter is single-process only. */
export function assertWritable(req: Request): void {
  assertWriteRateLimit(req);
  assertWriteAccess(req);
}

export function writeDeniedResponse(e: unknown): { body: { ok: false; error: string }; status: number } | null {
  if (e instanceof WriteDenied) {
    return { body: { ok: false, error: e.message }, status: e.status };
  }
  return null;
}
