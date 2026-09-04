import { getEnv } from './config/env.js';
import { EnvValidationError } from './config/env.js';
import { logger } from './utils/logger.js';
import { createApp } from './app.js';

/**
 * Server entrypoint. Environment configuration is validated before anything
 * else happens: missing Supabase credentials must fail fast with a clear
 * report (build-plan.md stop conditions - never guess credentials).
 */
function main(): void {
  let port: number;
  try {
    port = getEnv().PORT;
  } catch (error) {
    if (error instanceof EnvValidationError) {
      logger.error('environment_validation_failed', { issues: error.issues });
    } else {
      logger.error('environment_validation_failed', {
        message: error instanceof Error ? error.message : 'unknown',
      });
    }
    process.exitCode = 1;
    return;
  }

  const app = createApp();
  const server = app.listen(port, () => {
    logger.info('api_started', { port, env: getEnv().NODE_ENV });
  });

  const shutdown = (signal: string) => {
    logger.info('api_shutdown', { signal });
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();
