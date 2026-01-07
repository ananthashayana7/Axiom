import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    cssChunking: false,

  },
  // Force use of standard compiler instead of Turbopack

};

export default nextConfig;
