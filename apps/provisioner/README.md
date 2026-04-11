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
- `deploy/bin/deploy-vps.sh`

## VPS update flow

Use the repo checkout on the server as the only code source:

```bash
sudo /opt/qltracker-provisioner/app/deploy/bin/deploy-vps.sh
```

What it does:

- resets `/opt/qltracker-provisioner/app` to `origin/master`
- runs `npm ci` and `npm run build`
- syncs tracked minqlx plugins, factories, and baseq3 files from the repo
- syncs the tracked sudoers rule for slot `systemctl` access
- syncs the tracked systemd units and reloads systemd
- restarts `qltracker-provisioner` and verifies `http://127.0.0.1:7070/healthz`

The script refuses to deploy while any `qltracker-ql@*.service` slot is active unless `FORCE_ACTIVE_SLOT_DEPLOY=1` is set.

## Local commands

```bash
npm install
npm run check
npm run build
```

## Required env

See [`.env.example`](C:\Users\stupi\Documents\Repos\qltracker-provisioner\.env.example).
