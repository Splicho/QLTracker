# qltracker-realtime

Small self-hosted Socket.IO + Postgres backend for QLTracker.

## What it does

- accepts normalized server snapshots over HTTP
- can poll Steam directly for baseline server snapshots
- persists the latest snapshot in Postgres
- samples server history on a fixed interval for 7-day charts
- broadcasts live updates over Socket.IO
- lets clients subscribe to specific server addresses
- exposes single-player and batch presence lookups

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
- `POST /api/ingest/server-snapshot`

## Socket events

- client -> server: `servers:subscribe` with `{ addrs: string[] }`
- client -> server: `presence:subscribe` with `{ steamId: string }`
- client -> server: `presence:unsubscribe` with `{ steamId: string }`
- server -> client: `server:snapshot`
- server -> client: `player:presence`
