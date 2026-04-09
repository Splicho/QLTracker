import { ActivityType, type Client } from 'discord.js';

export function applyDefaultPresence(client: Client, activityName: string): void {
  if (!client.user) {
    return;
  }

  client.user.setPresence({
    status: 'online',
    activities: [
      {
        name: activityName,
        type: ActivityType.Playing
      }
    ]
  });
}
