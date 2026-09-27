import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Bundle the workspace packages into the server build instead of
  // externalizing them: their dist output uses extensionless relative ESM
  // specifiers, which webpack resolves but Vercel's serverless runtime
  // (plain Node ESM over traced files) cannot — that caused
  // ERR_MODULE_NOT_FOUND ('.../dist/common') 500s on every route.
  transpilePackages: ['@pharmaguard/types', '@pharmaguard/validation'],
  // Same-site proxy to the deployed API (Phase 14). The web client uses
  // credentials: 'include' with HttpOnly cookies (SameSite=Lax), which
  // browsers only attach to same-site requests — and every *.vercel.app
  // subdomain is its own site. Proxying /api/v1 through the web origin keeps
  // the cookies first-party and the API's CORS/cookie code untouched.
  // Local development calls the API directly (API_PROXY_URL is unset),
  // matching CORS_ALLOWED_ORIGINS there.
  async rewrites() {
    const api = process.env.API_PROXY_URL;
    if (!api) return [];
    return [{ source: '/api/v1/:path*', destination: `${api}/api/v1/:path*` }];
  },
  // Baseline security headers (security audit M-4). The CSP is deliberately
  // narrow — framing, plugins and base hijinks only — because a full
  // default-src policy needs an inventory of every third-party origin
  // (Supabase, fonts, analytics) and would risk breaking the app.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
