import { env } from '../config/env.js';
import { secondarySlashCommands, sharedSlashCommands } from '../discord/command-registry.js';

import type { BotDefinition } from './types.js';

const primaryBot: BotDefinition = {
  id: 'primary',
  displayName: env.DISCORD_PRIMARY_NAME,
  token: env.DISCORD_PRIMARY_TOKEN,
  clientId: env.DISCORD_PRIMARY_CLIENT_ID,
  activityName: 'Quake Live',
  commands: sharedSlashCommands,
  ...(env.DISCORD_PRIMARY_GUILD_ID ? { guildId: env.DISCORD_PRIMARY_GUILD_ID } : {})
};

const secondaryBot: BotDefinition | null =
  env.DISCORD_SECONDARY_TOKEN && env.DISCORD_SECONDARY_CLIENT_ID
    ? {
        id: 'secondary',
        displayName: env.DISCORD_SECONDARY_NAME,
        token: env.DISCORD_SECONDARY_TOKEN,
        clientId: env.DISCORD_SECONDARY_CLIENT_ID,
        activityName: 'Quake Live',
        commands: secondarySlashCommands,
        ...(env.DISCORD_SECONDARY_GUILD_ID ? { guildId: env.DISCORD_SECONDARY_GUILD_ID } : {})
      }
    : null;

export const botDefinitions: readonly BotDefinition[] = secondaryBot
  ? [primaryBot, secondaryBot]
  : [primaryBot];
