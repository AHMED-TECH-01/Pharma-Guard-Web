/**
 * Vercel serverless entry (project-root api directory convention).
 *
 * Re-exports the bundled Express app built by scripts/build-vercel.mjs into
 * dist-vercel/index.js. The bundle inlines @pharmaguard/* (extensionless
 * relative ESM specifiers crash plain-Node-ESM serverless execution) and
 * keeps npm dependencies external; the platform traces and includes those
 * from node_modules. apps/api/vercel.json sets framework null so no extra
 * framework-detection function is built from src/server.ts.
 */
export { default } from '../dist-vercel/index.js';
