import { Events } from 'discord.js';

import { applyDefaultPresence } from '../discord/presence.js';
import { logger } from '../shared/logger.js';

import type { DiscordEvent } from '../discord/types.js';

export const readyEvent: DiscordEvent<Events.ClientReady> = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    applyDefaultPresence(client);

    logger.info(
      {
        userTag: client.user.tag,
        guildCount: client.guilds.cache.size
      },
      'Discord bot is ready'
    );
  }
};
