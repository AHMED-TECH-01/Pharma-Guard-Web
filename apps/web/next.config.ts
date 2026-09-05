import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Bundle the workspace packages into the server build instead of
  // externalizing them: their dist output uses extensionless relative ESM
  // specifiers, which webpack resolves but Vercel's serverless runtime
  // (plain Node ESM over traced files) cannot — that caused
  // ERR_MODULE_NOT_FOUND ('.../dist/common') 500s on every route.
  transpilePackages: ['@pharmaguard/types', '@pharmaguard/validation'],
};

export default nextConfig;
