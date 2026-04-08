import { interactionCreateEvent } from './interaction-create.event.js';
import { readyEvent } from './ready.event.js';

import type { DiscordEvent } from '../discord/types.js';

export const discordEvents: readonly DiscordEvent[] = [readyEvent, interactionCreateEvent];
