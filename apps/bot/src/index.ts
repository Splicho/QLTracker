import { startBots } from './app/bootstrap.js';
import { logger } from './shared/logger.js';

process.on('unhandledRejection', (reason: unknown) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (error: Error) => {
  logger.fatal({ err: error }, 'Uncaught exception');
  process.exit(1);
});

void startBots().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Failed to start configured Discord bots');
  process.exitCode = 1;
});
