import { WriteDenied } from './write-denied';

type Bucket = { n: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function clientKey(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'local';
  return req.headers.get('x-real-ip') ?? 'local';
}

/**
 * In-memory write-API limiter. Effective for a single Node process only.
 * Multi-instance deploys need a shared store — until then, treat this as
 * a local ceiling, not a cluster quota.
 */
export function assertWriteRateLimit(req: Request): void {
  const max = Number(process.env.STAR_WRITE_RATE_LIMIT || 30);
  const windowMs = Number(process.env.STAR_WRITE_RATE_WINDOW_MS || 60_000);
  const now = Date.now();
  const key = clientKey(req);
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { n: 1, resetAt: now + windowMs });
    return;
  }
  if (current.n >= max) {
    throw new WriteDenied(429, 'write rate limit exceeded');
  }
  current.n += 1;
}

export function resetWriteRateLimitForTests(): void {
  buckets.clear();
}
