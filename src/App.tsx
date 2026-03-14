import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTheme } from "next-themes";
import {
  ExternalLink,
  KeyRound,
  Monitor,
  Moon,
  RefreshCw,
  Search,
  Sun,
  Users,
  Wifi,
} from "lucide-react";
import { fetchServers } from "@/lib/steam";
import type { QuakeServer } from "@/lib/types";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const DEFAULT_SEARCH = "\\appid\\282440";

function formatPing(ping: number | null | undefined) {
  return typeof ping === "number" ? `${ping} ms` : "n/a";
}

function launchUrl(server: QuakeServer) {
  return `steam://run/282440//${encodeURIComponent(server.connect_url)}`;
}

export function App() {
  const { resolvedTheme, setTheme, theme } = useTheme();
  const [apiKey, setApiKey] = useLocalStorage("qlist-steam-api-key", "");
  const [search, setSearch] = useLocalStorage("qlist-search-filter", DEFAULT_SEARCH);
  const [limit, setLimit] = useLocalStorage("qlist-limit", "50");
  const [selected, setSelected] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["servers", apiKey, search, limit],
    queryFn: () =>
      fetchServers({
        apiKey,
        search,
        limit: Number.parseInt(limit, 10) || 50,
      }),
    enabled: apiKey.trim().length > 0,
  });

  const servers = query.data ?? [];
  const selectedServer =
    servers.find((server) => server.addr === selected) ?? servers[0] ?? null;

  const totals = useMemo(() => {
    const playerCount = servers.reduce((sum, server) => sum + server.players, 0);
    return {
      servers: servers.length,
      players: playerCount,
    };
  }, [servers]);

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 md:px-6">
      <section className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/50 bg-black/4 dark:bg-black/10">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="bg-background/40">
                    Steam-powered desktop browser
                  </Badge>
                  <div className="inline-flex rounded-full border border-border/70 bg-background/60 p-1 backdrop-blur">
                    <ThemeButton
                      active={theme === "light"}
                      label="Light"
                      icon={<Sun className="size-4" />}
                      onClick={() => setTheme("light")}
                    />
                    <ThemeButton
                      active={theme === "dark"}
                      label="Dark"
                      icon={<Moon className="size-4" />}
                      onClick={() => setTheme("dark")}
                    />
                    <ThemeButton
                      active={theme === "system"}
                      label={`System${resolvedTheme ? ` ${resolvedTheme}` : ""}`}
                      icon={<Monitor className="size-4" />}
                      onClick={() => setTheme("system")}
                    />
                  </div>
                </div>
                <div>
                  <CardTitle className="text-3xl">QList</CardTitle>
                  <CardDescription className="mt-2 max-w-2xl text-sm leading-6">
                    Quake Live server discovery for desktop. Steam&apos;s server list API
                    provides the candidate servers, and live query packets fill in ping and
                    player detail.
                  </CardDescription>
                </div>
              </div>
              <div className="grid min-w-64 grid-cols-2 gap-3 text-right">
                <StatCard label="Visible servers" value={totals.servers.toString()} />
                <StatCard label="Players online" value={totals.players.toString()} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 pt-6">
            <div className="grid gap-3 md:grid-cols-[1fr_170px_140px]">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Steam API key</label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Paste your Steam Web API key"
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Limit</label>
                <Input value={limit} onChange={(event) => setLimit(event.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Server filter</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => void query.refetch()} disabled={!apiKey || query.isFetching}>
                <RefreshCw className={query.isFetching ? "size-4 animate-spin" : "size-4"} />
                Refresh
              </Button>
              <p className="text-sm text-muted-foreground">
                Default filter: <code>{DEFAULT_SEARCH}</code>
              </p>
            </div>

            {query.error ? (
              <Card className="border-destructive/60 bg-destructive/10">
                <CardContent className="p-4 text-sm">
                  {query.error instanceof Error ? query.error.message : "Server query failed."}
                </CardContent>
              </Card>
            ) : null}

            <div className="grid gap-3">
              {servers.map((server) => (
                <button
                  key={server.addr}
                  type="button"
                  onClick={() => setSelected(server.addr)}
                  className={`grid rounded-xl border px-4 py-4 text-left transition hover:border-primary/50 hover:bg-white/3 ${
                    selectedServer?.addr === server.addr
                      ? "border-primary/60 bg-primary/10"
                      : "border-border/50 bg-black/4 dark:bg-black/10"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{server.name}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {server.addr} · {server.map}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="secondary">
                        {server.players}/{server.max_players}
                      </Badge>
                      <Badge variant="outline">{formatPing(server.ping_ms)}</Badge>
                    </div>
                  </div>
                </button>
              ))}
              {!query.isFetching && servers.length === 0 && apiKey ? (
                <Card>
                  <CardContent className="p-6 text-sm text-muted-foreground">
                    No servers matched the current filter.
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Server Detail</CardTitle>
            <CardDescription>
              Live details and player roster for the selected Quake Live host.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedServer ? (
              <>
                <div>
                  <div className="text-xl font-semibold">{selectedServer.name}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{selectedServer.addr}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <DetailTile
                    label="Ping"
                    value={formatPing(selectedServer.ping_ms)}
                    icon={<Wifi className="size-4" />}
                  />
                  <DetailTile
                    label="Players"
                    value={`${selectedServer.players}/${selectedServer.max_players}`}
                    icon={<Users className="size-4" />}
                  />
                  <DetailTile label="Map" value={selectedServer.map} />
                  <DetailTile label="Version" value={selectedServer.version ?? "n/a"} />
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium">Players</div>
                  <div className="space-y-2">
                    {selectedServer.players_info.length > 0 ? (
                      selectedServer.players_info.map((player) => (
                        <div
                          key={`${player.name}-${player.score}-${player.duration_seconds}`}
                          className="flex items-center justify-between rounded-lg border border-border/60 bg-black/4 px-3 py-2 text-sm dark:bg-black/10"
                        >
                          <span>{player.name || "Unnamed player"}</span>
                          <span className="text-muted-foreground">{player.score}</span>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-lg border border-dashed border-border/60 px-3 py-4 text-sm text-muted-foreground">
                        No player details returned from the server.
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={() => void openUrl(launchUrl(selectedServer))}
                >
                  <ExternalLink className="size-4" />
                  Launch Quake Live
                </Button>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">
                Enter a Steam API key and refresh to load servers.
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-black/4 px-4 py-3 dark:bg-black/10">
      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function DetailTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-black/4 p-3 dark:bg-black/10">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-sm font-medium">{value}</div>
    </div>
  );
}

function ThemeButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
