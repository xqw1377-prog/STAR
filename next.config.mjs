/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@electric-sql/pglite'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // PGlite's ESM uses new URL(..., import.meta.url); webpack's rewrite
      // yields a WHATWG polyfill URL that Node fs rejects. Keep it a real
      // node module on the server (the browser idb path stays bundled).
      config.externals.push('@electric-sql/pglite');
    }
    return config;
  },
};

export default nextConfig;
