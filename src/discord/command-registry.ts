import { pingCommand } from '../features/system/commands/ping.command.js';
import { uptimeCommand } from '../features/system/commands/uptime.command.js';

import type { SlashCommand } from './types.js';

export const sharedSlashCommands: readonly SlashCommand[] = [pingCommand, uptimeCommand];
