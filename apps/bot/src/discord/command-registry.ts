import { pingCommand } from '../features/system/commands/ping.command.js';
import { ratingCommand } from '../features/pickup/commands/rating.command.js';
import { steamIdCommand } from '../features/pickup/commands/steamid.command.js';
import { uptimeCommand } from '../features/system/commands/uptime.command.js';

import type { SlashCommand } from './types.js';

export const sharedSlashCommands: readonly SlashCommand[] = [pingCommand, uptimeCommand];

export const secondarySlashCommands: readonly SlashCommand[] = [
  ...sharedSlashCommands,
  ratingCommand,
  steamIdCommand
];
