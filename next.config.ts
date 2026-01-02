import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    cssChunking: false,
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },
  // Force use of standard compiler instead of Turbopack
  webpack: (config, { dev, isServer }) => {
    return config;
  },
};

export default nextConfig;
