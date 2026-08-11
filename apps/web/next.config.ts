import type { NextConfig } from 'next';
import path from 'node:path';
import { buildSecurityHeaders } from './lib/security-headers';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(process.cwd(), '../..'),
  poweredByHeader: false,
  async headers() {
    return [{
      source: '/(.*)',
      headers: buildSecurityHeaders({
        apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3005/api',
        isDevelopment: process.env.NODE_ENV !== 'production',
      }),
    }];
  },
};

export default nextConfig;
