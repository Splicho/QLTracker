import { Events } from 'discord.js';

import type { BotDefinition } from '../bots/types.js';
import { applyDefaultPresence } from '../discord/presence.js';
import { logger } from '../shared/logger.js';

import type { DiscordEvent } from '../discord/types.js';

export function createReadyEvent(bot: BotDefinition): DiscordEvent<Events.ClientReady> {
  return {
    name: Events.ClientReady,
    once: true,
    execute(client) {
      applyDefaultPresence(client, bot.activityName);

      logger.info(
        {
          botId: bot.id,
          botName: bot.displayName,
          commands: bot.commands.map((command) => `/${command.data.name}`),
          presence: bot.activityName,
          userTag: client.user.tag,
          guildCount: client.guilds.cache.size
        },
        'Discord bot ready with commands'
      );
    }
  };
}
