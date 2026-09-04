import { execSync } from 'child_process';

function resolveBuildSha() {
  if (process.env.STAR_COMMIT_SHA) return process.env.STAR_COMMIT_SHA;
  if (process.env.NEXT_PUBLIC_BUILD_SHA) return process.env.NEXT_PUBLIC_BUILD_SHA;
  try {
    return execSync('git rev-parse HEAD', { cwd: process.cwd() }).toString().trim();
  } catch {
    return 'dev';
  }
}

const BUILD_SHA = resolveBuildSha();

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    STAR_COMMIT_SHA: BUILD_SHA,
    NEXT_PUBLIC_BUILD_SHA: BUILD_SHA,
  },
  experimental: {
    // Real node module in the RSC/server layer (bundling breaks PGlite's
    // new URL(..., import.meta.url) asset resolution). The browser idb path
    // is severed from SSR via app/providers-ssr.tsx (dynamic, ssr:false).
    serverComponentsExternalPackages: ['@electric-sql/pglite'],
  },
};

export default nextConfig;
