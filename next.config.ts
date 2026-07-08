import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['@union-networks/issuer', '@union-networks/web-login'],
  },
};

export default nextConfig;
