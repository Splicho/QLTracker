# QLTracker

![QLTracker preview](src/assets/images/screenshot.png)

QLTracker is an open-source desktop server browser for Quake Live.

It combines Steam server discovery with qlstats and optional TrueSkill enrichment, plus favorites, player lookups, Discord notifications, and direct join support.

## Features

- Live Quake Live server list
- Filters for search, region, visibility, mode, tags, maps, and rating range
- Server drawer with player details, QElo, TSkill, and qlstats links
- Favorites with custom lists
- Discord notifications for favorited public servers
- Direct join through Steam
- Built-in updater for packaged releases

## Requirements

- Node.js 20+
- Rust toolchain
- Tauri prerequisites for your platform
- Steam Web API key

## Quick Start

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

Build the frontend:

```bash
npm run build
```

## Environment

Current app env vars:

```env
VITE_STEAM_API_KEY=
VITE_STEAM_APP_ID=282440
VITE_QLSTATS_API_URL=https://qlstats.net/api
VITE_TRUESKILL_URL_TEMPLATE=http://qlrelax.freemyip.com/elo/bn/%s
VITE_NOTIFICATION_API_URL=
```

Notes:

- `VITE_STEAM_API_KEY` is required for server discovery.
- `VITE_NOTIFICATION_API_URL` enables the optional Discord notification backend.
- The Discord/web backend lives in the separate `qltracker-web` repo.

## Configuration

About dialog metadata is stored in:

- [src/config/about.yml](src/config/about.yml)

## Releases

Packaged builds are published through GitHub Releases and include self-update support.

Current release workflow:

- [.github/workflows/release.yml](.github/workflows/release.yml)

Supported release targets:

- Windows x64
- Windows ARM64
- Linux x64
- Linux ARM64

## Contributing

Contribution notes live in:

- [CONTRIBUTING.md](CONTRIBUTING.md)

## License

MIT. See [LICENSE](LICENSE).
