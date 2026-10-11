import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@napi-rs/canvas', 'pdfjs-dist'],
  outputFileTracingIncludes: {
    '/api/ocr': [
      './node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
      './node_modules/pdfjs-dist/legacy/build/pdf.mjs',
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // קישור קצר לפרויקט: /p/f8f95e8a → פותח את המערכת עם בחירת הפרויקט אחרי ההתחברות
  async redirects() {
    return [
      {
        source: '/p/:code',
        destination: '/?p=:code',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
