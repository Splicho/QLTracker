# Contributing

## Scope

This repository contains the full QLTracker monorepo. Keep changes scoped to
the app or package you are actually modifying.

## Development workflow

1. Install dependencies with `pnpm install`.
2. Run targeted checks before opening a PR.
3. Prefer filtered commands for the area you changed.

Examples:

```bash
pnpm --filter @qltracker/web lint
pnpm --filter @qltracker/web typecheck
pnpm --filter @qltracker/realtime build
pnpm --filter @qltracker/bot build
```

For cross-cutting changes, run the full workspace checks:

```bash
pnpm lint
pnpm typecheck
pnpm build
```

## Guidelines

- Keep shared packages focused on pure contracts, config, and reusable helpers.
- Avoid pulling app-specific runtime logic into shared packages without a clear
  reason.
- Preserve deployment boundaries between `web`, `realtime`, `provisioner`, and
  `bot`.
- Document any new environment variables in the relevant app `.env.example`.
- If a change affects multiple apps, update the shared contract/package first.

## Pull requests

- Explain the user-facing impact.
- Mention affected apps or packages.
- Include any deployment or migration steps when relevant.
