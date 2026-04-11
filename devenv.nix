{ pkgs, lib, config, ... }:

let
  dbName = "qltracker";
  dbUser =
    let user = builtins.getEnv "USER";
    in if user != "" then user else "postgres";
  runtimeDir = "${config.env.DEVENV_RUNTIME}/postgres";
  dbHost = if config.services.postgres.enable then config.env.PGHOST else runtimeDir;
  dbPort = if config.services.postgres.enable then config.env.PGPORT else config.services.postgres.port;
  pythonBin = "${pkgs.python3}/bin/python3";
  opensslLibPath = lib.makeLibraryPath [ pkgs.openssl ];
  prismaEngines = pkgs.prisma-engines_6;
in
{
  packages = with pkgs; [
    bash
    coreutils
    nodePackages.typescript
    git
    gnugrep
    nodejs_20
    openssl
    pnpm
    postgresql
    python3
    util-linux
    (writeShellScriptBin "eslint" ''
      exec pnpm --filter @qltracker/web exec eslint "$@"
    '')
  ];

  services.postgres.enable = true;

  env.CORS_ORIGIN = lib.mkDefault "http://localhost:3000";
  env.DATABASE_URL = lib.mkDefault
    "postgresql://${dbUser}@localhost/${dbName}?host=${dbHost}&port=${toString dbPort}";
  env.NEXT_PUBLIC_REALTIME_URL = lib.mkDefault "http://127.0.0.1:3011";
  env.LD_LIBRARY_PATH = lib.mkDefault opensslLibPath;
  env.PYTHON = lib.mkDefault pythonBin;
  env.PGDATABASE = lib.mkDefault dbName;
  env.PGHOST = lib.mkIf (!config.services.postgres.enable) (lib.mkDefault dbHost);
  env.PGPORT = lib.mkIf (!config.services.postgres.enable) (lib.mkDefault dbPort);
  env.PGUSER = lib.mkDefault dbUser;
  env.PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING = lib.mkDefault "1";
  env.PRISMA_FMT_BINARY = lib.mkDefault "${prismaEngines}/bin/prisma-fmt";
  env.PRISMA_QUERY_ENGINE_LIBRARY = lib.mkDefault "${prismaEngines}/lib/libquery_engine.node";
  env.PRISMA_SCHEMA_ENGINE_BINARY = lib.mkDefault "${prismaEngines}/bin/schema-engine";
  env.PUBLIC_BASE_URL = lib.mkDefault "http://localhost:3000";
  env.REALTIME_INGEST_TOKEN = lib.mkDefault "change-me";
  env.SESSION_SECRET = lib.mkDefault "qltracker-local-session-secret-change-me";
  env.npm_config_python = lib.mkDefault pythonBin;

  scripts.bootstrap.exec = ''
    set -euo pipefail

    mkdir -p .devenv .devenv/state
    exec 9>.devenv/bootstrap.lock
    flock 9

    setupStamp=.devenv/state/setup-complete.stamp

    echo "[devenv] waiting for postgres"
    until pg_isready >/dev/null 2>&1; do
      sleep 1
    done

    if ! psql template1 -v ON_ERROR_STOP=1 -tAc \
      "select 1 from pg_database where datname = '${dbName}'" | grep -q 1; then
      echo "[devenv] creating database ${dbName}"
      createdb "${dbName}"
    fi

    if [ ! -f .devenv/state/pnpm-install.stamp ] || [ pnpm-lock.yaml -nt .devenv/state/pnpm-install.stamp ]; then
      echo "[devenv] installing workspace dependencies"
      pnpm install --frozen-lockfile
      touch .devenv/state/pnpm-install.stamp
    fi

    needsSetup=0
    if [ ! -f "$setupStamp" ]; then
      needsSetup=1
    elif [ pnpm-lock.yaml -nt "$setupStamp" ] || [ devenv.nix -nt "$setupStamp" ]; then
      needsSetup=1
    elif find \
      apps/web \
      apps/realtime \
      packages/config \
      packages/contracts \
      packages/crypto \
      packages/maps \
      packages/quake \
      package.json \
      turbo.json \
      -type f -newer "$setupStamp" | grep -q .; then
      needsSetup=1
    fi

    if [ "$needsSetup" -eq 0 ]; then
      echo "[devenv] setup already up to date"
      exit 0
    fi

    rm -f "$setupStamp"

    echo "[devenv] building shared workspace packages for web + realtime"
    pnpm --filter @qltracker/config build
    pnpm --filter @qltracker/contracts build
    pnpm --filter @qltracker/crypto build
    pnpm --filter @qltracker/maps build
    pnpm --filter @qltracker/quake build

    echo "[devenv] generating Prisma client"
    pnpm --filter @qltracker/web prisma:generate

    echo "[devenv] applying Prisma migrations"
    pnpm --filter @qltracker/web prisma:migrate:deploy

    echo "[devenv] applying realtime schema"
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/realtime/sql/schema.sql

    touch "$setupStamp"
  '';

  scripts.reset-db.exec = ''
    set -euo pipefail

    echo "[devenv] waiting for postgres"
    until pg_isready >/dev/null 2>&1; do
      sleep 1
    done

    echo "[devenv] dropping database ${dbName}"
    dropdb --if-exists "${dbName}"
    rm -f .devenv/state/setup-complete.stamp
    bootstrap
  '';

  tasks."qltracker:setup".exec = ''
    mkdir -p .devenv/logs .devenv/state
    exec > >(tee -a .devenv/logs/setup.log) 2>&1

    bootstrap
  '';
  tasks."qltracker:setup".before = [
    "devenv:processes:realtime"
    "devenv:processes:web"
  ];

  processes.realtime.exec = ''
    mkdir -p .devenv/logs
    exec > >(tee -a .devenv/logs/realtime.log) 2>&1

    echo "[devenv] starting realtime"
    pnpm --filter @qltracker/realtime dev
  '';

  processes.web.exec = ''
    mkdir -p .devenv/logs
    exec > >(tee -a .devenv/logs/web.log) 2>&1

    if [ -z "''${STEAM_API_KEY:-}" ]; then
      echo "[devenv] STEAM_API_KEY is required for apps/web."
      echo "[devenv] Define it in devenv.local.nix, for example:"
      echo '  { lib, ... }: { env.STEAM_API_KEY = lib.mkForce "your-steam-api-key"; }'
      exit 1
    fi

    echo "[devenv] starting web"
    pnpm --filter @qltracker/web dev
  '';

  enterShell = ''
    echo "QLTracker devenv ready."
    echo "Set STEAM_API_KEY in devenv.local.nix before running the web app."
    echo "Use 'bootstrap' for setup or 'devenv up' to start postgres + realtime + web."
  '';
}
