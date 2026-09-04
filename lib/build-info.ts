/** Non-secret build identity. Never include RPC URLs or paths. */
export const BUILD_SHA =
  process.env.NEXT_PUBLIC_BUILD_SHA
  || process.env.STAR_COMMIT_SHA
  || 'dev';

export const ENGINE_VERSION = `star-eval@${BUILD_SHA.slice(0, 12)}`;
