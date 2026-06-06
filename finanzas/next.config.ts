import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: '/finanzas',
  trailingSlash: true,
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
