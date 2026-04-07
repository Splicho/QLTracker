# qltracker-provisioner

Standalone VPS-side provisioner for Quake Live pickup servers with minqlx.

## What it does

- Exposes `POST /api/pickups/provision` for `qltracker-realtime`
- Allocates one of four fixed pickup slots
- Generates slot-specific Quake Live/minqlx config
- Starts the slot through systemd
- Waits for a local ready callback from the custom minqlx plugin
- Posts a signed live callback when the match starts
- Posts signed match results back to `qltracker-realtime`

## Runtime layout

- App: `/opt/qltracker-provisioner/app`
- Slot state/config: `/var/lib/qltracker-provisioner/slots`
- QLDS base: `/opt/qltracker-qlds`
- systemd:
  - `qltracker-provisioner.service`
  - `qltracker-ql@.service`

## Deploy helpers

- `deploy/bin/bootstrap-vps.sh`
- `deploy/bin/install-qlds.sh`

## Local commands

```bash
npm install
npm run check
npm run build
```

## Required env

See [`.env.example`](C:\Users\stupi\Documents\Repos\qltracker-provisioner\.env.example).
