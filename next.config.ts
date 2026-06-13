import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@napi-rs/canvas', 'pdfjs-dist'],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
