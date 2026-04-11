import { botDefinitions } from '../bots/definitions.js';
import { registerCommandsForBots } from '../discord/register-commands.js';
import { logger } from '../shared/logger.js';

void registerCommandsForBots(botDefinitions).catch((error: unknown) => {
  logger.fatal({ err: error }, 'Failed to register slash commands for configured bots');
  process.exitCode = 1;
});
