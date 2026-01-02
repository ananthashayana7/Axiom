import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    cssChunking: false,
  },
};

export default nextConfig;
