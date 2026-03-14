# Contributing to QLTracker

Thanks for contributing.

## Development setup

Requirements:

- Node.js 20+
- Rust toolchain
- Tauri prerequisites for your platform
- Steam Web API key

Install dependencies:

```bash
npm install
```

Create a local env file:

```bash
cp .env.example .env.local
```

Run the app:

```bash
npm run dev
```

## Project expectations

- Keep changes focused and pragmatic.
- Preserve the existing UI patterns unless a redesign is intentional.
- Prefer typed data flows over ad-hoc objects.
- Keep Tauri-side network and cache behavior explicit, especially for third-party services.

## Before opening a PR

Run the relevant checks locally:

```bash
npx tsc --noEmit
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

If your change affects packaged app behavior, also test a desktop run with:

```bash
npm run dev
```

## Pull requests

- Describe the user-facing change clearly.
- Mention any new env vars, config changes, or release-impacting changes.
- Include screenshots for visible UI changes when possible.
- Keep unrelated refactors out of the same PR.

## Issues

Bug reports are most useful when they include:

- expected behavior
- actual behavior
- reproduction steps
- logs or screenshots
- platform details

## Security

Do not commit:

- `.env.local`
- API keys
- updater private keys
- passwords or server secrets
