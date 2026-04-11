# QLTracker Web

QLTracker Web is the Next.js web app and API for QLTracker.

It ships:

- server discovery
- favorites
- watchlist
- pickup
- pickup profiles
- leaderboards
- match pages
- public news and notices
- admin dashboard

This repo is the web surface and shared app/API layer. Realtime matchmaking and server snapshots stay in `qltracker-realtime`. Game server orchestration stays in `qltracker-provisioner`.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- TanStack Query
- Prisma
- PostgreSQL

## Related Services

- `qltracker-web`
  Next.js app, public frontend, SEO, auth routes, pickup/admin APIs, news, notices

- `qltracker-realtime`
  server snapshots, presence, pickup realtime state, matchmaking, Socket.IO

- `qltracker-provisioner`
  pickup game server slot orchestration

## Requirements

- Node.js `>=20.9.0`
- pnpm or npm
- PostgreSQL

The repo includes:

- [.nvmrc](/C:/Users/stupi/Documents/Repos/qltracker-web/.nvmrc)
- [.node-version](/C:/Users/stupi/Documents/Repos/qltracker-web/.node-version)

## Environment Variables

Required:

```bash
PUBLIC_BASE_URL=http://localhost:3000
DATABASE_URL=postgresql://user:password@host:port/db
STEAM_API_KEY=your_steam_api_key
SESSION_SECRET=your_long_random_secret
PICKUP_ADMIN_STEAM_IDS=7656119...,7656119...
NEXT_PUBLIC_REALTIME_URL=https://ws.qltracker.com
```

Optional:

```bash
PICKUP_AUTH_COOKIE_NAME=qltracker-pickup-session
WORKER_POLL_INTERVAL_MS=30000
QLSTATS_API_URL=https://qlstats.net/api
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

Notes:

- `SESSION_SECRET` must match the secret used by `qltracker-realtime` for shared pickup auth/session behavior.
- `NEXT_PUBLIC_REALTIME_URL` must point at the deployed realtime service.
- provisioner URL/auth and R2 upload credentials are configured through admin/shared pickup settings in the database, not through frontend env vars in this repo.

## Local Development

Install dependencies:

```bash
pnpm install
```

Start the app:

```bash
pnpm dev
```

Open:

```bash
http://localhost:3000
```

## Scripts

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm type-check
pnpm format
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:migrate:deploy
```

## Production Build

```bash
pnpm build
pnpm start
```

If you see a Windows `EPERM` error during `prisma generate`, stop the local dev server and rerun the build. That error is a local file-lock issue on the generated Prisma engine, not a database migration or data-loss operation.

## Database

This repo uses Prisma with the schema in [prisma/schema.prisma](/C:/Users/stupi/Documents/Repos/qltracker-web/prisma/schema.prisma).

Safe:

- `prisma generate`
- `prisma validate`

Can change the database:

- `prisma migrate dev`
- `prisma migrate deploy`

## Routes

Public:

- `/servers`
- `/favorites`
- `/watchlist`
- `/pickup`
- `/leaderboards`
- `/players/[playerId]`
- `/matches/[matchId]`
- `/news`
- `/news/[slug]`
- `/settings`

Admin:

- `/admin`
- `/admin/news`
- `/admin/notices`
- `/admin/servers`
- `/admin/settings`

API:

- `/api/pickup/*`
- `/api/news`
- `/api/notices`
- `/api/realtime/*`

## Analytics

Google Analytics 4 is enabled only when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set.

```bash
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

## Deployment Notes

- deploy with Node 20+
- ensure the hosting platform does not default to Node 18
- configure `NEXT_PUBLIC_REALTIME_URL` to the live realtime host
- allow the deployed web origin in `qltracker-realtime` CORS
- keep `SESSION_SECRET` aligned across web and realtime

## Current Status

The repo currently builds cleanly with:

- `pnpm lint`
- `pnpm type-check`
- `pnpm build`

The main remaining production work is operational:

- correct envs
- realtime CORS/origin config
- final live smoke test of Steam login, pickup flow, and admin actions
