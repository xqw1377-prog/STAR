/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Real node module in the RSC/server layer (bundling breaks PGlite's
    // new URL(..., import.meta.url) asset resolution). The browser idb path
    // is severed from SSR via app/providers-ssr.tsx (dynamic, ssr:false).
    serverComponentsExternalPackages: ['@electric-sql/pglite'],
  },
};

export default nextConfig;
