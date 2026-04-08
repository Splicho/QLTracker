# qltracker-bot

Lightweight Discord bot scaffold built with `discord.js` and TypeScript.

## Features

- Slash-command based command handling
- `Playing Quake Live` presence on startup
- Strict env validation with `zod`
- Structured logging with `pino`
- Separate command registration script for guild or global commands
- Feature-oriented project layout that stays small but scales cleanly

## Project structure

```text
src/
  app/                  # Process bootstrap and lifecycle
  config/               # Environment loading and validation
  discord/              # Discord-specific contracts, registry, and presence
  events/               # Discord event handlers
  features/             # Bot feature modules and slash commands
  scripts/              # One-off operational scripts
  shared/               # Logger and shared utilities
```

## Setup

1. Create a Discord application and bot in the Discord developer portal.
2. Enable the `SERVER MEMBERS INTENT` only if you add features that need it. The current scaffold only needs `Guilds`.
3. Copy `.env.example` to `.env` and fill in the values.
4. Install dependencies:

```bash
npm install
```

5. Register slash commands in your development guild:

```bash
npm run register:commands
```

If `DISCORD_GUILD_ID` is omitted, commands are registered globally instead.

6. Start the bot in development:

```bash
npm run dev
```

## Scripts

- `npm run dev` starts the bot with file watching via `tsx`
- `npm run build` compiles the project to `dist/`
- `npm run start` runs the compiled bot
- `npm run typecheck` performs a no-emit TypeScript validation pass
- `npm run register:commands` pushes slash commands to Discord

## Notes

- Slash command changes only take effect after re-running `npm run register:commands`.
- Guild command updates are near-instant; global command updates can take longer to propagate.
- To keep the bot online in production, run `npm run build && npm run start` under a process manager or container platform.
