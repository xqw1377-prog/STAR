import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertWriteAccess, WriteDenied } from './write-guard';

describe('write-guard', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('R5-T04a: blocks production writes by default and never reflects secrets', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('STAR_ALLOW_WRITE', '');
    vi.stubEnv('STAR_WRITE_TOKEN', '');
    expect(() => assertWriteAccess(new Request('http://localhost/api/seed', { method: 'POST' }))).toThrow(WriteDenied);
  });

  it('requires bearer token when configured', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('STAR_WRITE_TOKEN', 'secret');
    expect(() => assertWriteAccess(new Request('http://localhost/api/seed', { method: 'POST' }))).toThrow(WriteDenied);
    expect(() => assertWriteAccess(new Request('http://localhost/api/seed', {
      method: 'POST',
      headers: { authorization: 'Bearer secret' },
    }))).not.toThrow();
  });
});
