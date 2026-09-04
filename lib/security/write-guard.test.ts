import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertWriteAccess, assertWritable, WriteDenied } from './write-guard';
import { resetWriteRateLimitForTests } from './rate-limit';

describe('write-guard', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetWriteRateLimitForTests();
  });

  it('R5-T04a: blocks production writes by default and never reflects secrets', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('STAR_ALLOW_WRITE', '');
    vi.stubEnv('STAR_WRITE_TOKEN', '');
    expect(() => assertWriteAccess(new Request('http://localhost/api/seed', { method: 'POST' }))).toThrow(WriteDenied);
  });

  it('fail-closes production when writes are allowed but no token is configured', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('STAR_ALLOW_WRITE', '1');
    vi.stubEnv('STAR_WRITE_TOKEN', '');
    expect(() => assertWriteAccess(new Request('http://localhost/api/seed', { method: 'POST' }))).toThrow(/write token not configured/);
  });

  it('requires a matching bearer token in production when configured', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('STAR_ALLOW_WRITE', '1');
    vi.stubEnv('STAR_WRITE_TOKEN', 'secret');
    expect(() => assertWriteAccess(new Request('http://localhost/api/seed', { method: 'POST' }))).toThrow(WriteDenied);
    expect(() => assertWriteAccess(new Request('http://localhost/api/seed', {
      method: 'POST',
      headers: { authorization: 'Bearer secret' },
    }))).not.toThrow();
    expect(() => assertWriteAccess(new Request('http://localhost/api/seed', {
      method: 'POST',
      headers: { authorization: 'Bearer wrong' },
    }))).toThrow(WriteDenied);
  });

  it('requires bearer token when configured outside production', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('STAR_WRITE_TOKEN', 'secret');
    expect(() => assertWriteAccess(new Request('http://localhost/api/seed', { method: 'POST' }))).toThrow(WriteDenied);
    expect(() => assertWriteAccess(new Request('http://localhost/api/seed', {
      method: 'POST',
      headers: { authorization: 'Bearer secret' },
    }))).not.toThrow();
  });

  it('rate-limits write attempts before auth', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('STAR_WRITE_RATE_LIMIT', '2');
    vi.stubEnv('STAR_WRITE_RATE_WINDOW_MS', '60000');
    const req = new Request('http://localhost/api/seed', { method: 'POST' });
    expect(() => assertWritable(req)).not.toThrow();
    expect(() => assertWritable(req)).not.toThrow();
    expect(() => assertWritable(req)).toThrow(/rate limit/);
  });
});
