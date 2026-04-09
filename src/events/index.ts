import { createInteractionCreateEvent } from './interaction-create.event.js';
import { createReadyEvent } from './ready.event.js';

import type { BotDefinition } from '../bots/types.js';

import type { DiscordEvent } from '../discord/types.js';

export function createDiscordEvents(bot: BotDefinition): readonly DiscordEvent[] {
  return [createReadyEvent(bot), createInteractionCreateEvent(bot)];
}
