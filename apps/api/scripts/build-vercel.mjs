/**
 * Vercel build for the API (see apps/api/vercel.json buildCommand).
 *
 * Bundles the Express app into a single self-contained ESM file at
 * dist-vercel/index.js, which the committed serverless entry api/index.js
 * re-exports. apps/api/vercel.json sets framework null (no framework
 * detection, so no extra function is built from src/server.ts, whose traced
 * @pharmaguard/* files crash the serverless runtime) and outputDirectory
 * "public" (an empty static output; the API serves no static files).
 *
 * Why bundling is required: @pharmaguard/types and @pharmaguard/validation
 * compile with moduleResolution "Bundler", so their dist output uses
 * extensionless relative ESM specifiers. Vercel's serverless runtime executes
 * traced files with plain Node ESM resolution and crashes on them with
 * ERR_MODULE_NOT_FOUND (same root cause as the web 500s; webpack hides it
 * locally). esbuild resolves those specifiers at bundle time, so no package
 * sources need to change.
 *
 * npm dependencies stay external: they resolve normally from node_modules at
 * runtime (traced by @vercel/node), which keeps bundled-size low and avoids
 * breaking packages that read data files from disk (pdfkit font metrics).
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const apiRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// apps/api -> repo root (packages live at <root>/packages)
const workspaceRoot = path.dirname(path.dirname(apiRoot));

const virtualEntry = `
import { createApp } from './src/app.js';
// Build the app once per cold start: env validation (getEnv via CORS/cookie
// config) fails fast with a clear report if configuration is missing, exactly
// like the standalone server entry. The default export is the Express app,
// which the @vercel/node runtime wraps as the request handler.
const app = createApp();
export default app;
`;

await build({
  stdin: {
    contents: virtualEntry,
    resolveDir: apiRoot,
    sourcefile: 'vercel-entry.ts',
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: path.join(apiRoot, 'dist-vercel', 'index.js'),
  // Third-party packages stay in node_modules; only the workspace packages
  // are inlined (their onResolve below runs before the externalization).
  packages: 'external',
  logLevel: 'info',
  plugins: [
    {
      name: 'inline-workspace-packages',
      setup(build) {
        build.onResolve({ filter: /^@pharmaguard\// }, (args) => {
          const name = args.path.split('/')[1];
          return {
            path: path.join(workspaceRoot, 'packages', name, 'dist', 'index.js'),
            external: false,
          };
        });
      },
    },
  ],
});

// Static output required by vercel.json outputDirectory. The API serves no
// static files; a minimal index page satisfies Vercel's non-empty check and
// answers requests to / (every other path is rewritten to the function).
fs.mkdirSync(path.join(apiRoot, 'public'), { recursive: true });
fs.writeFileSync(
  path.join(apiRoot, 'public', 'index.html'),
  '<!doctype html><title>PharmaGuard API</title>' +
    '<p>PharmaGuard API is running. Liveness probe: <a href="/api/v1/health">/api/v1/health</a></p>',
);
