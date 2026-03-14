export type ServerPlayer = {
  name: string;
  score: number;
  duration_seconds: number;
};

export type QuakeServer = {
  addr: string;
  steamid?: string | null;
  name: string;
  map: string;
  game_directory: string;
  game_description: string;
  app_id: number;
  players: number;
  max_players: number;
  bots: number;
  ping_ms?: number | null;
  region?: number | null;
  version?: string | null;
  keywords?: string | null;
  connect_url: string;
  players_info: ServerPlayer[];
};
