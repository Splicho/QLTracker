# Apps

This folder contains the deployable QLTracker applications.

## Structure

- `web` - frontend, admin UI, public pages, auth flows, and browser-side pickup
  experience
- `realtime` - pickup queues, match lifecycle, ingestion, and realtime APIs
- `provisioner` - VPS-side Quake Live server allocation and match orchestration
- `bot` - Discord bots, queue alert webhooks, and related integrations

Each app keeps its own runtime code, environment variables, and deployment
surface, while shared contracts and helpers live under `packages/`.
