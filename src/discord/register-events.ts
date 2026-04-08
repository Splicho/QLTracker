import type { Client } from 'discord.js';

import { logger } from '../shared/logger.js';

import type { DiscordEvent } from './types.js';

export function registerEvents(client: Client, events: readonly DiscordEvent[]): void {
  for (const event of events) {
    const runEvent = (...args: unknown[]): void => {
      Promise.resolve(event.execute(...(args as never))).catch((error: unknown) => {
        logger.error({ err: error, eventName: event.name }, 'Discord event handler failed');
      });
    };

    if (event.once) {
      client.once(event.name, (...args) => {
        runEvent(...args);
      });
      continue;
    }

    client.on(event.name, (...args) => {
      runEvent(...args);
    });
  }
}
