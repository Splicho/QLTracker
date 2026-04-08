# AGENTS.md

## Project scope

This repository contains a lightweight, production-minded Discord bot scaffold for Quake Live related automation and tracking.

Current scope:
- Run a single Discord bot process with slash commands
- Keep a constant Discord presence of `Playing Quake Live`
- Provide a clean foundation for future Quake Live features such as stats, player lookups, match notifications, and server utilities

Out of scope for the scaffold:
- Database integration
- External API integrations
- Web dashboards
- Message-content command parsing

## Technical direction

- Runtime: Node.js with TypeScript and ESM
- Discord library: `discord.js`
- Command style: slash commands only
- Configuration: `.env` with runtime validation
- Logging: structured logs
- Architecture: small feature modules behind shared Discord contracts

## Working conventions

- Keep the bot lightweight. Add dependencies only when they solve a concrete need.
- Prefer slash commands over prefix commands or raw message parsing.
- Put reusable Discord wiring under `src/discord/`.
- Put user-facing bot features under `src/features/`.
- Keep startup and lifecycle concerns under `src/app/`.
- Validate all new environment variables in `src/config/env.ts`.
- Avoid introducing persistence layers until a real feature requires them.

## Operational expectations

- Register commands with `npm run register:commands` after changing command definitions.
- Use `DISCORD_GUILD_ID` during development for fast command iteration.
- Run `npm run typecheck` and `npm run build` before handing off changes.
