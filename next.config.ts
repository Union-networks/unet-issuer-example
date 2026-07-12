import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/issuer/requests/\\[requestId\\]/decision': [
      './node_modules/@aztec/bb.js/dest/node/barretenberg_wasm/barretenberg-threads.wasm.gz',
    ],
  },
  experimental: {
    optimizePackageImports: ['@union-networks/issuer', '@union-networks/web-login'],
  },
};

export default nextConfig;
