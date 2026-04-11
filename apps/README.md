# Application Overview

Each app in this folder is a standalone deployable service. They can be run
independently or together through the monorepo workspace.

| App | Purpose | Default Port | Tech Stack | Deploy Target |
| --- | --- | --- | --- | --- |
| `web` | Public website, server browser, pickup UI, admin pages, and account flows | App platform managed | Next.js, React, Prisma | Dokploy |
| `realtime` | Pickup state, queue lifecycle, ingestion, and service APIs | `3011` | Node.js, TypeScript, PostgreSQL, Steam APIs | Dokploy |
| `provisioner` | Quake Live pickup server allocation, match orchestration, and VPS-side control | `7070` | Node.js, TypeScript, systemd, minqlx, ZeroMQ | Dedicated VPS |
| `bot` | Discord bots, queue alerts, and chat-side integrations | `8788` internal webhook listener | Node.js, TypeScript, Discord.js-style bot runtime | Dokploy |

## Notes

- `web`, `realtime`, and `bot` are intended to deploy from the monorepo in
  Dokploy.
- `provisioner` is not a normal app-platform service. It runs on a dedicated
  VPS because it needs direct access to systemd, Quake Live server files, and
  minqlx runtime assets.
- Shared cross-service logic lives under `packages/`.
