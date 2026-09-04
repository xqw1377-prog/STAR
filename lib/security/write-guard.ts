export class WriteDenied extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function bearer(req: Request): string | null {
  const raw = req.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(raw);
  return match?.[1] ?? null;
}

/**
 * Production write APIs are closed unless STAR_ALLOW_WRITE=1 and a token matches.
 * Local/test may omit the token. Never reflect secrets.
 */
export function assertWriteAccess(req: Request): void {
  const production = process.env.NODE_ENV === 'production';
  const allow = process.env.STAR_ALLOW_WRITE === '1';
  const token = process.env.STAR_WRITE_TOKEN;

  if (production && !allow) {
    throw new WriteDenied(403, 'write APIs disabled in production');
  }
  if (token && bearer(req) !== token) {
    throw new WriteDenied(401, 'write token required');
  }
}

export function writeDeniedResponse(e: unknown): { body: { ok: false; error: string }; status: number } | null {
  if (e instanceof WriteDenied) {
    return { body: { ok: false, error: e.message }, status: e.status };
  }
  return null;
}
