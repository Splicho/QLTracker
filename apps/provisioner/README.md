# qltracker-provisioner

Provisioner app for the QLTracker monorepo. This still runs on a standalone VPS-side host with minqlx.

## What it does

- Exposes `POST /api/pickups/provision` for `qltracker-realtime`
- Allocates one of four fixed pickup slots
- Generates slot-specific Quake Live/minqlx config
- Starts the slot through systemd
- Waits for a local ready callback from the custom minqlx plugin
- Posts a signed live callback when the match starts
- Posts signed match results back to `qltracker-realtime`

## Runtime layout

- Repo root: `/opt/qltracker`
- App: `/opt/qltracker/apps/provisioner`
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

Use the monorepo checkout on the server as the only code source:

```bash
sudo /opt/qltracker/apps/provisioner/deploy/bin/deploy-vps.sh
```

What it does:

- resets `/opt/qltracker` to `origin/main`
- runs `pnpm install --frozen-lockfile`
- builds only `@qltracker/provisioner`
- syncs tracked minqlx plugins, factories, and baseq3 files from the provisioner app
- syncs the tracked sudoers rule for slot `systemctl` access
- syncs the tracked systemd units and reloads systemd
- restarts `qltracker-provisioner` and verifies `http://127.0.0.1:7070/healthz`

The script refuses to deploy while any `qltracker-ql@*.service` slot is active unless `FORCE_ACTIVE_SLOT_DEPLOY=1` is set.

## Local commands

```bash
pnpm install
pnpm --filter @qltracker/provisioner check
pnpm --filter @qltracker/provisioner build
```

## Required env

See `apps/provisioner/.env.example`.
