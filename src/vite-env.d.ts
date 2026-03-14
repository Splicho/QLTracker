/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_QLSTATS_API_URL?: string;
  readonly VITE_STEAM_API_KEY?: string;
  readonly VITE_STEAM_APP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
