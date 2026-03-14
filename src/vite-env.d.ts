/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly PACKAGE_VERSION?: string;
  readonly VITE_QLSTATS_API_URL?: string;
  readonly VITE_STEAM_API_KEY?: string;
  readonly VITE_STEAM_APP_ID?: string;
  readonly VITE_TRUESKILL_URL_TEMPLATE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
