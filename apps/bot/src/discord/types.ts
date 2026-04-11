import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  ClientEvents,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder
} from 'discord.js';

export type SlashCommandData =
  | SlashCommandBuilder
  | SlashCommandOptionsOnlyBuilder
  | SlashCommandSubcommandsOnlyBuilder;

export interface SlashCommand {
  readonly data: SlashCommandData;
  autocomplete?(interaction: AutocompleteInteraction): Promise<void>;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

export interface DiscordEvent<K extends keyof ClientEvents = keyof ClientEvents> {
  readonly name: K;
  readonly once?: boolean;
  execute(...args: ClientEvents[K]): Promise<void> | void;
}
