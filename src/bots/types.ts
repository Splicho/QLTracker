import type { SlashCommand } from '../discord/types.js';

export interface BotDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly token: string;
  readonly clientId: string;
  readonly guildId?: string;
  readonly activityName: string;
  readonly commands: readonly SlashCommand[];
}
