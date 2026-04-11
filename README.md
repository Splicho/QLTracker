# QLTracker

QLTracker is a Quake Live platform that combines a web app, realtime services,
pickup orchestration, and Discord integrations in a single monorepo.

## Repository layout

- `apps/web` - Next.js frontend, admin tools, and public pickup UI
- `apps/realtime` - pickup state, ingest, and service APIs
- `apps/provisioner` - VPS-side pickup server provisioner for Quake Live/minqlx
- `apps/bot` - Discord bots and queue alert integrations
- `packages/contracts` - shared schemas and typed cross-service payloads
- `packages/config` - shared config parsing helpers
- `packages/crypto` - shared signing and token helpers
- `packages/maps` - shared map metadata
- `packages/quake` - shared Quake text helpers

See [apps/README.md](/C:/Users/stupi/Documents/Repos/qltracker/apps/README.md)
for a quick overview of the app folders.

## Requirements

- Node.js 20.x
- pnpm 10.x

## Getting started

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm build
```

Run individual apps with filters:

```bash
pnpm --filter @qltracker/web dev
pnpm --filter @qltracker/realtime dev
pnpm --filter @qltracker/provisioner dev
pnpm --filter @qltracker/bot dev
```

## Deployment

- `web`, `realtime`, and `bot` are intended to be deployed from the monorepo in
  Dokploy or another app platform.
- `provisioner` runs on a dedicated VPS and is deployed by the provisioner
  deploy script and GitHub Actions workflow.

## Contributing

See [CONTRIBUTING.md](/C:/Users/stupi/Documents/Repos/qltracker/CONTRIBUTING.md).

## License

This project is licensed under the MIT License. See
[LICENSE](/C:/Users/stupi/Documents/Repos/qltracker/LICENSE).
