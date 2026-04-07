# qltracker-realtime

Small self-hosted Socket.IO + Postgres backend for QLTracker.

## What it does

- accepts normalized server snapshots over HTTP
- can poll Steam directly for baseline server snapshots
- persists the latest snapshot in Postgres
- persists player name history per SteamID in Postgres
- samples server history on a fixed interval for 7-day charts
- broadcasts live updates over Socket.IO
- lets clients subscribe to specific server addresses
- exposes single-player and batch presence lookups
- runs the live pickup queue, ready check, captain veto, provisioning, and match state

## Quick start

1. Copy `.env.example` to `.env`.
2. Create the tables from `sql/schema.sql`.
3. Install dependencies with `npm install`.
4. Run `npm run dev`.

## HTTP endpoints

- `GET /health`
- `GET /api/servers/:addr`
- `GET /api/servers/:addr/history?range=7d&bucket=15m`
- `POST /api/servers/lookup`
- `GET /api/presence/:steamId`
- `POST /api/presence/lookup`
- `GET /api/players/:steamId/name-history`
- `POST /api/players/name-history/lookup`
- `POST /api/ingest/server-snapshot`
- `GET /api/pickup/public-state`
- `GET /api/pickup/me/state`
- `POST /api/pickup/callbacks/provisioned`
- `POST /api/pickup/callbacks/live`
- `POST /api/pickup/callbacks/result`

## Socket events

- client -> server: `servers:subscribe` with `{ addrs: string[] }`
- client -> server: `presence:subscribe` with `{ steamId: string }`
- client -> server: `presence:unsubscribe` with `{ steamId: string }`
- client -> server: `pickup:queue:join`
- client -> server: `pickup:queue:leave`
- client -> server: `pickup:lobby:ready`
- client -> server: `pickup:veto:ban` with `{ mapKey: string }`
- server -> client: `server:snapshot`
- server -> client: `player:presence`
- server -> client: `pickup:public-state`
- server -> client: `pickup:player-state`

## Pickup Notes

- `SESSION_SECRET` must match the `SESSION_SECRET` used by `qltracker-web`, because pickup app-session tokens are hashed and validated in both services.
- Pickup routes expect the shared pickup tables from `sql/schema.sql`.
- Provisioning configuration is stored on the pickup queue row in Postgres: `provisionApiUrl`, `provisionAuthToken`, and `callbackSecret`.
- Provision, live, and result callbacks must include the `x-pickup-signature` header, signed as `HMAC-SHA256(callbackSecret, rawBody)`.
