import type {
  ChatInputCommandInteraction,
  ClientEvents,
  SlashCommandBuilder
} from 'discord.js';

export interface SlashCommand {
  readonly data: SlashCommandBuilder;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

export interface DiscordEvent<K extends keyof ClientEvents = keyof ClientEvents> {
  readonly name: K;
  readonly once?: boolean;
  execute(...args: ClientEvents[K]): Promise<void> | void;
}
