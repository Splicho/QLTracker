import { pingCommand } from '../features/system/commands/ping.command.js';
import { uptimeCommand } from '../features/system/commands/uptime.command.js';

import type { SlashCommand } from './types.js';

export const slashCommands: readonly SlashCommand[] = [pingCommand, uptimeCommand];

const commandMap = new Map(slashCommands.map((command) => [command.data.name, command] as const));

export function getSlashCommand(name: string): SlashCommand | undefined {
  return commandMap.get(name);
}
