import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: '/finanzas',
  trailingSlash: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  compress: true,
  async headers() {
    return [
      {
        source: '/api/mobile/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, max-age=60, stale-while-revalidate=120' },
        ],
      },
      {
        source: '/api/stats',
        headers: [
          { key: 'Cache-Control', value: 'private, max-age=120, stale-while-revalidate=300' },
        ],
      }
    ];
  }
};

export default nextConfig;
