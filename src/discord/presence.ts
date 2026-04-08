import { ActivityType, type Client } from 'discord.js';

export function applyDefaultPresence(client: Client): void {
  if (!client.user) {
    return;
  }

  client.user.setPresence({
    status: 'online',
    activities: [
      {
        name: 'Quake Live',
        type: ActivityType.Playing
      }
    ]
  });
}
