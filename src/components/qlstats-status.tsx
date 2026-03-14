import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CircleAlert, LoaderCircle, Users } from "lucide-react";
import { fetchQlStatsOnlinePlayers } from "@/lib/qlstats";

const qlStatsApiUrl = import.meta.env.VITE_QLSTATS_API_URL?.trim() ?? "";

export function QlStatsStatus() {
  const query = useQuery({
    queryKey: ["qlstats", "players", "online", qlStatsApiUrl],
    queryFn: () => fetchQlStatsOnlinePlayers(qlStatsApiUrl),
    enabled: qlStatsApiUrl.length > 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const summary = useMemo(() => {
    if (!query.data || query.data.length === 0) {
      return null;
    }

    return query.data
      .slice(0, 4)
      .map((player) => player.name)
      .join(", ");
  }, [query.data]);

  if (!qlStatsApiUrl) {
    return null;
  }

  return (
    <section className="border-b border-border px-4 py-2.5">
      {query.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          <span>Loading QLStats online players...</span>
        </div>
      ) : null}

      {query.isError ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CircleAlert className="size-4" />
          <span>QLStats unavailable.</span>
        </div>
      ) : null}

      {query.isSuccess ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-2 font-medium text-foreground">
            <Users className="size-4 text-muted-foreground" />
            QLStats Online
          </span>
          <span className="text-muted-foreground">
            {query.data.length} player{query.data.length === 1 ? "" : "s"}
          </span>
          {summary ? <span className="truncate text-muted-foreground">{summary}</span> : null}
        </div>
      ) : null}
    </section>
  );
}
