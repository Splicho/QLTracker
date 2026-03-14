import { invoke } from "@tauri-apps/api/core";
import type { QuakeServer } from "@/lib/types";

export type FetchServersInput = {
  apiKey: string;
  search: string;
  limit: number;
};

export async function fetchServers(input: FetchServersInput) {
  return invoke<QuakeServer[]>("fetch_quake_live_servers", {
    apiKey: input.apiKey,
    search: input.search,
    limit: input.limit,
  });
}
