import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/issuer/requests/[requestId]/decision': [
      './server-assets/barretenberg-threads.wasm.gz',
    ],
  },
  experimental: {
    optimizePackageImports: ['@union-networks/web-login'],
  },
};

export default nextConfig;
