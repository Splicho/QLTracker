# qltracker-bot

Lightweight Discord bot scaffold built with `discord.js` and TypeScript, with support for running two Discord bots from one repository and one Node.js process.

## Features

- Slash-command based command handling
- Per-bot startup presence: both bots play `Quake Live`
- Strict env validation with `zod`
- Structured logging with `pino`
- Separate command registration flow for guild or global commands
- Primary and secondary bot configuration from one codebase
- Feature-oriented project layout that stays small but scales cleanly

## Project structure

```text
src/
  app/                  # Process bootstrap and lifecycle
  bots/                 # Per-bot definitions and metadata
  config/               # Environment loading and validation
  discord/              # Discord-specific contracts, registry, and presence
  events/               # Discord event handlers
  features/             # Bot feature modules and slash commands
  scripts/              # One-off operational scripts
  shared/               # Logger and shared utilities
```

## Setup

1. Create one or two Discord applications and bot users in the Discord developer portal.
2. Enable the `SERVER MEMBERS INTENT` only if you add features that need it. The current scaffold only needs `Guilds`.
3. Copy `.env.example` to `.env` and fill in the primary bot values. Fill in the secondary bot values if you want to run both bots.
4. Install dependencies:

```bash
npm install
```

5. Register slash commands:

```bash
npm run register:commands
```

If `DISCORD_PRIMARY_GUILD_ID` or `DISCORD_SECONDARY_GUILD_ID` is omitted for a configured bot, that bot's commands are registered globally instead.
If only primary credentials are configured, only the primary bot is registered and started.

6. Start the configured bots in development:

```bash
npm run dev
```

## Scripts

- `npm run dev` starts the bot with file watching via `tsx`
- `npm run build` compiles the project to `dist/`
- `npm run start` runs all configured bots from the compiled output
- `npm run typecheck` performs a no-emit TypeScript validation pass
- `npm run register:commands` pushes slash commands for all configured bots

## Notes

- Slash command changes only take effect after re-running `npm run register:commands`.
- Guild command updates are near-instant; global command updates can take longer to propagate.
- To keep both bots online in production, run `npm run build && npm run start` under a process manager or container platform.
