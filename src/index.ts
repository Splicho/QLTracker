import { startBot } from './app/bootstrap.js';
import { logger } from './shared/logger.js';

process.on('unhandledRejection', (reason: unknown) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (error: Error) => {
  logger.fatal({ err: error }, 'Uncaught exception');
  process.exit(1);
});

void startBot().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Bot failed to start');
  process.exitCode = 1;
});
